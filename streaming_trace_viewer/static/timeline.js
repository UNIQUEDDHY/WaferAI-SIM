const margin = { top: 30, right: 20, bottom: 30, left: 140 };
const canvasWidth = 1600;
const canvasHeight = 1000;
const width = canvasWidth - margin.left - margin.right;
const height = canvasHeight - margin.top - margin.bottom;

const canvas = document.getElementById("traceCanvas");
const ctx = canvas.getContext("2d");

// 全局状态
let events = [];
let filteredEvents = [];
let coreMap = {};
let threadMap = {};
let coreThreads = {}; // core -> Set(tid)
let intervals = [];   // 所有已解析的 interval
let flows = {};
let globalStack = {};
let trackY = {};      // trackLabel -> y position
let nextY = 0;        // 下一个可用的 Y 位置
const threadHeight = 20;

let transform = { x: 0, y: 0, k: 1 }; // pan/zoom state
let timeDomain = [0, 1]; // [t0, t1] in nanoseconds — 替代 xaltscale

// Offscreen canvas for track labels
let trackLabelCanvas = document.createElement("canvas");
let trackLabelCtx = trackLabelCanvas.getContext("2d");

// D3 scales (for coordinate math only)
let xScale = d3.scaleLinear().range([0, width]);
let yScale = d3.scaleLinear().range([0, height]);

let autoReloadTimer = null;

// ======================
// Input Handling
// ======================

canvas.addEventListener("wheel", function (event) {
  if (event.altKey) {
    event.preventDefault();

    // 获取当前鼠标位置对应的时间
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - margin.left;
    const xScaleZoom = d3.zoomIdentity.translate(transform.x, 0).scale(transform.k).rescaleX(xScale);
    const timeAtMouse = xScaleZoom.invert(mouseX);

    // 缩放因子：向上滚（deltaY < 0）是放大
    const factor = event.deltaY > 0 ? 2.0 : 0.5; // 放大：缩小时间窗口

    const domainWidth = timeDomain[1] - timeDomain[0];
    const newDomainWidth = domainWidth * factor;

    // 可选：限制最小时间窗口（防止数值不稳定）
    // 如果你想支持更高倍率，可将 0.01 改为 0.001 或更小
    if (newDomainWidth < 0.01) {
      // 不允许再放大（可选）
      // return;
    }

    // 以鼠标位置为中心缩放
    const ratio = (timeAtMouse - timeDomain[0]) / domainWidth;
    const newT0 = timeAtMouse - ratio * newDomainWidth;
    const newT1 = timeAtMouse + (1 - ratio) * newDomainWidth;

    timeDomain = [newT0, newT1];
    render();
  } else if (event.ctrlKey) {
    // 原有水平缩放（实际无效，因为时间轴由 timeDomain 控制）
    // 保留但可忽略
    event.preventDefault();
    const scaleFactor = event.deltaY > 0 ? 0.95 : 1.05;
    const newK = Math.max(1, Math.min(10, transform.k * scaleFactor));

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left - margin.left;
    const xScaleZoom = d3.zoomIdentity.translate(transform.x, 0).scale(transform.k).rescaleX(xScale);
    const timeAtMouse = xScaleZoom.invert(mouseX);
    const newX = mouseX - xScale(timeAtMouse) * newK;

    transform = { x: newX, y: transform.y, k: newK };
    render();
  } else {
    // 垂直平移（滚动）
    event.preventDefault();
    const dy = -event.deltaY * 0.4;
    transform = { x: transform.x, y: transform.y + dy, k: transform.k };
    render();
  }
});

// Drag to pan (horizontal/vertical)
let isDragging = false;
let lastX, lastY;

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  transform.x += dx;
  transform.y += dy;
  lastX = e.clientX;
  lastY = e.clientY;
  render();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
  canvas.style.cursor = "default";
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
  canvas.style.cursor = "default";
});

// ======================
// Data Processing
// ======================

function processEvents(newEvents) {
  for (const e of newEvents) {
    // === 处理 metadata (M) ===
    if (e.ph === "M" && e.name === "process_name") {
      coreMap[e.pid] = e.args.name;
    } else if (e.ph === "M" && e.name === "thread_name") {
      const key = `${e.pid}-${e.tid}`;
      threadMap[key] = e.args.name;
      const core = coreMap[e.pid] || `Core ${e.pid}`;
      if (!coreThreads[core]) coreThreads[core] = new Set();
      coreThreads[core].add(e.tid);
    }

    // === 处理 B/E/X 事件 ===
    if (e.ph === "B") {
      if (!globalStack) globalStack = {};
      globalStack[`${e.pid}-${e.tid}-${e.name}-${e.ts}`] = e;
    } else if (e.ph === "E") {
      for (const key in globalStack) {
        const b = globalStack[key];
        if (b.name === e.name && b.pid === e.pid && b.tid === e.tid) {
          const interval = createIntervalFromPair(b, e);
          intervals.push(interval);
          delete globalStack[key];
          break;
        }
      }
    } else if (e.ph === "X" && e.dur !== undefined) {
      const interval = createIntervalFromX(e);
      intervals.push(interval);
    }

    // === 处理 flow (s/f) ===
    if (e.ph === "s" || e.ph === "f") {
      if (!flows[e.id]) flows[e.id] = {};
      flows[e.id][e.ph] = e;
    }
  }

  // Recalculate trackY if needed
  let needRecalc = false;
  for (const iv of intervals) {
    if (trackY[iv.trackLabel] === undefined) {
      needRecalc = true;
      break;
    }
  }
  if (needRecalc) {
    recalculateTrackY();
  }
}

function createIntervalFromPair(b, e) {
  const coreName = coreMap[b.pid] || `Core ${b.pid}`;
  const threadKey = `${b.pid}-${b.tid}`;
  const threadName = threadMap[threadKey] || `TID ${b.tid}`;
  return {
    ...b,
    dur: e.ts - b.ts,
    coreName,
    threadName,
    trackLabel: `${coreName} / ${threadName}`,
    id: `${b.pid}-${b.tid}-${b.ts}`
  };
}

function createIntervalFromX(e) {
  const coreName = coreMap[e.pid] || `Core ${e.pid}`;
  const threadKey = `${e.pid}-${e.tid}`;
  const threadName = threadMap[threadKey] || `TID ${e.tid}`;
  return {
    ...e,
    coreName,
    threadName,
    trackLabel: `${coreName} / ${threadName}`,
    id: `${e.pid}-${e.tid}-${e.ts}`
  };
}

function recalculateTrackY() {
  const cores = Object.keys(coreThreads).sort();
  let currentY = 0;
  const newTrackY = {};
  for (const core of cores) {
    const pids = Object.keys(coreMap).filter(pid => coreMap[pid] === core);
    const threads = [];
    for (const pid of pids) {
      for (const tid of coreThreads[core]) {
        const key = `${pid}-${tid}`;
        if (threadMap[key]) {
          threads.push({ pid: Number(pid), tid, name: threadMap[key] });
        }
      }
    }
    threads.sort((a, b) => a.tid - b.tid);
    for (const t of threads) {
      const label = `${core} / ${t.name}`;
      newTrackY[label] = currentY;
      currentY += threadHeight;
    }
  }
  trackY = newTrackY;
  nextY = currentY;
}

// ======================
// Rendering
// ======================

function render() {
  if (intervals.length === 0) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    return;
  }

  // 初始化 timeDomain（仅首次或清空后）
  if (timeDomain[0] === 0 && timeDomain[1] === 1) {
    const allTs = intervals.flatMap(e => [e.ts, e.ts + (e.dur || 0)]);
    const minTs = Math.min(...allTs);
    const maxTs = Math.max(...allTs);
    timeDomain = [minTs, maxTs || minTs + 1];
  }

  // 设置 X 轴时间范围
  xScale.domain(timeDomain);

  const xScaleZoom = d3.zoomIdentity.translate(transform.x, 0).scale(transform.k).rescaleX(xScale);

  // Clear
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Draw track labels
  drawTrackLabels();

  // Draw intervals
  ctx.save();
  ctx.translate(margin.left, margin.top);
  for (const iv of intervals) {
    if (!trackY.hasOwnProperty(iv.trackLabel)) continue;
    const x = xScaleZoom(iv.ts);
    const w = Math.max(1, xScaleZoom(iv.ts + iv.dur) - x); // 至少 1 像素
    const y = trackY[iv.trackLabel] - transform.y;
    if (y + threadHeight < -10 || y > height + 10) continue; // cull

    let hash = 0;
    for (let i = 0; i < iv.name.length; i++) hash = iv.name.charCodeAt(i) + ((hash << 5) - hash);
    const color = "#" + (hash & 0x00FFFFFF).toString(16).padStart(6, '0');
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, threadHeight);
  }
  ctx.restore();

  // Draw flows
  ctx.save();
  ctx.translate(margin.left, margin.top);
  ctx.strokeStyle = "#f00";
  ctx.lineWidth = 1.5;
  for (const f of Object.values(flows)) {
    if (!f.s || !f.f) continue;
    const sCore = coreMap[f.s.pid] || `Core ${f.s.pid}`;
    const sThread = threadMap[`${f.s.pid}-${f.s.tid}`] || `TID ${f.s.tid}`;
    const fCore = coreMap[f.f.pid] || `Core ${f.f.pid}`;
    const fThread = threadMap[`${f.f.pid}-${f.f.tid}`] || `TID ${f.f.tid}`;

    const label1 = `${sCore} / ${sThread}`;
    const label2 = `${fCore} / ${fThread}`;
    if (!trackY[label1] || !trackY[label2]) continue;

    const y1 = trackY[label1] - transform.y + threadHeight / 2;
    const y2 = trackY[label2] - transform.y + threadHeight / 2;
    const x1 = xScaleZoom(f.s.ts);
    const x2 = xScaleZoom(f.f.ts);

    if ((y1 < -10 || y1 > height + 10) && (y2 < -10 || y2 > height + 10)) continue;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.translate(x2, y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, -3);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fillStyle = "#f00";
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Draw X axis
  drawXAxis(xScaleZoom);
}

function drawTrackLabels() {
  trackLabelCanvas.width = margin.left;
  trackLabelCanvas.height = canvasHeight;
  trackLabelCtx.clearRect(0, 0, margin.left, canvasHeight);

  trackLabelCtx.fillStyle = "#e0e0ff";
  trackLabelCtx.font = "12px 'Roboto Mono', monospace";
  trackLabelCtx.textAlign = "right";
  trackLabelCtx.textBaseline = "middle";

  for (const [label, y] of Object.entries(trackY)) {
    const drawY = margin.top + y - transform.y;
    if (drawY + threadHeight > 0 && drawY - threadHeight < canvasHeight) {
      trackLabelCtx.fillText(label, margin.left - 12, drawY + threadHeight / 2);
    }
  }

  ctx.drawImage(trackLabelCanvas, 0, 0);
}

// 自动选择合适格式：ns, ps, fs
function formatTime(t) {
  if (Math.abs(t) >= 1e3) return d3.format(".3s")(t) + "ns";
  if (Math.abs(t) >= 1) return d3.format(".3f")(t) + "ns";
  if (Math.abs(t) >= 1e-3) return d3.format(".3f")(t * 1e3) + "ps";
  if (Math.abs(t) >= 1e-6) return d3.format(".3f")(t * 1e6) + "fs";
  return d3.format(".3e")(t) + "s";
}



function drawXAxis(xScaleZoom) {
  ctx.save();
  ctx.translate(margin.left, margin.top + height);
  ctx.fillStyle = "#e0e0ff";
  ctx.strokeStyle = "#a0a0ff";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const ticks = xScale.ticks(10);
  for (const t of ticks) {
    const x = xScaleZoom(t);
    if (x < -50 || x > width + 50) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 5);
    ctx.stroke();// 然后
    ctx.fillText(formatTime(t), x, 8);
  }
  ctx.restore();
}

// ======================
// UI & Socket Handlers
// ======================

const socket = io();

socket.on("init_events", (data) => {
  events = [];
  filteredEvents = [];
  coreMap = {};
  threadMap = {};
  coreThreads = {};
  intervals = [];
  flows = {};
  globalStack = {};
  trackY = {};
  nextY = 0;
  timeDomain = [0, 1]; // 重置时间域

  events = data;
  filteredEvents = [...events];
  processEvents(filteredEvents);
  render();
});

socket.on("new_events", (newEvents) => {
  processEvents(newEvents);
  render();
});

socket.on("clear_events", () => {
  events = [];
  filteredEvents = [];
  coreMap = {};
  threadMap = {};
  coreThreads = {};
  intervals = [];
  flows = {};
  globalStack = {};
  trackY = {};
  nextY = 0;
  timeDomain = [0, 1];
  document.getElementById("searchInput").value = "";
  render();
});

socket.on("log_message", (msg) => {
  const line = document.createElement("div");
  line.textContent = msg;
  document.getElementById("logContent").appendChild(line);
  document.getElementById("logContent").scrollTop = document.getElementById("logContent").scrollHeight;
});

function filterEvents() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  if (!query) {
    filteredEvents = [...events];
  } else {
    filteredEvents = events.filter(e => e.name && e.name.toLowerCase().includes(query));
  }
  intervals = [];
  flows = {};
  globalStack = {};
  processEvents(filteredEvents);
  render();
}

function resetZoom() {
  transform = { x: 0, y: 0, k: 1 };
  if (intervals.length > 0) {
    const allTs = intervals.flatMap(e => [e.ts, e.ts + (e.dur || 0)]);
    const minTs = Math.min(...allTs);
    const maxTs = Math.max(...allTs);
    timeDomain = [minTs, maxTs || minTs + 1];
  } else {
    timeDomain = [0, 1];
  }
  render();
}

function toggleAutoReload() {
  const enabled = document.getElementById("autoReload").checked;
  if (enabled) {
    autoReloadTimer = setInterval(() => {
      filterEvents();
    }, 2000);
  } else {
    clearInterval(autoReloadTimer);
  }
}

function runSimulation() {
  const configFile = document.getElementById("configFile").value;
  const coreConfigFile = document.getElementById("coreConfigFile").value;
  const statusDiv = document.getElementById("simStatus");

  statusDiv.textContent = "Running...";
  statusDiv.style.color = "#007bff";

  fetch("/run-simulation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workload_config: configFile, hardware_config: coreConfigFile })
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        statusDiv.textContent = "❌ Error: " + data.error;
        statusDiv.style.color = "#dc3545";
      } else {
        statusDiv.textContent = "✅ Started (PID: " + data.pid + ")";
        statusDiv.style.color = "#28a745";
      }
    })
    .catch(err => {
      statusDiv.textContent = "❌ Network error";
      statusDiv.style.color = "#dc3545";
    });
}

function clearTrace() {
  if (!confirm("Are you sure you want to clear all trace events?")) return;

  fetch("/clear-trace", { method: "POST" })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        events = [];
        filteredEvents = [];
        render();
        document.getElementById("searchInput").value = "";
        alert("Trace cleared successfully!");
      } else {
        alert("Error: " + data.error);
      }
    })
    .catch(err => {
      alert("Network error: " + err);
    });
}

function clearLog() {
  document.getElementById("logContent").innerHTML = "";
}

let isLogHidden = false;

function toggleLogVisibility() {
  isLogHidden = document.getElementById("hideLog").checked;
  const logPanel = document.getElementById("logPanel");
  logPanel.style.display = isLogHidden ? "none" : "flex";
  socket.emit("log_visibility", isLogHidden);
}

// ======================
// Init
// ======================

window.addEventListener("load", () => {
  const saved = localStorage.getItem("hideLog");
  const hideLog = saved !== null ? (saved === "true") : true;
  document.getElementById("hideLog").checked = hideLog;
  toggleLogVisibility();
});
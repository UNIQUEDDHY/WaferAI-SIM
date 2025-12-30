<div align="center">
<picture>
<img alt="WaferAI-SIM" src="doc/images/logo.png" width=50%>
</picture>
</div>

<h3 align="center">
🚀 WaferAI-SIM: 面向多核 NPU 的轻量化、多层次模拟仿真框架
</h3>

<p align="center">
| <a href="[https://npu-sim.readthedocs.io/zh-cn/latest/](https://npu-sim.readthedocs.io/zh-cn/latest/)"><b>📖 文档中心</b></a> | <a href="[https://github.com/user-attachments/assets/16d4f604-30a7-43bc-a2e8-a6a776718708](https://github.com/user-attachments/assets/16d4f604-30a7-43bc-a2e8-a6a776718708)"><b>🎬 演示视频</b></a> |
</p>

<p align="center">
<a href="README.md">English</a> | <strong>中文</strong>
</p>

---

## 💡 项目简介

**WaferAI-SIM** 是一款专为多核神经网络处理器（NPU）设计的轻量化、大规模、多层次仿真框架。它为大语言模型（LLM）等大规模模型的系统级分析提供了强大的支持。🛠️

* **🧩 灵活的并行性：** 探索各种张量并行（Tensor Parallelism）策略。
* **📍 可定制的核心放置：** 支持用户自定义的计算核心放置策略。
* **💾 高级内存管理：** 模拟多种内存管理机制与策略。
* **🔄 可配置的数据流：** 支持预填充-解码分离（PD-disaggregation）与融合（PD-fusion）的选择。

**系统架构图：**

<div align="center">
<p align="center">
<img src="doc/images/arch.png" width="80%"/>
</p>
</div>

---

## ✨ 核心特性

* **🔬 多层次仿真：** 同时支持事务级（Transaction-level）和基于性能模型（Performance-model-based）的仿真。
* **🏗️ 晶圆级建模：** 支持对使用混合键合（Hybrid Bonding）和分布式内存架构的下一代硬件进行分析。
* **📊 实时可视化：** 配备交互式 GUI，可实时监控仿真进程。

## 🎬 演示

**GUI 可视化界面**:

[gui-video.mp4](gui_video.mp4)

---

## 🛠️ 安装指南

我们提供基于 Docker 的环境，以确保构建和运行环境的一致性。 🐳

### 1. 构建镜像

构建过程大约需要 **3 分钟**。

```bash
docker build -t waferai-sim:latest .
```

### 2. 运行容器

启动交互式容器：

```bash
docker run -it -p 8000:8000 waferai-sim:latest
```

### 3. 执行仿真

进入容器后，您可以在当前目录下找到可执行文件 `npusim`。

---

## 🤖 模型支持与配置

**WaferAI-SIM** 设计了一套完善的自动化工具链，旨在简化大规模模型仿真的配置流程。 ⚡

### 📝 支持的模型架构

本框架原生支持多种主流 LLM 架构，能够精确模拟其算子行为和数据流：

* **LLAMA 系列** (Llama-2/3, 7B 到 70B)
* **GPT 系列** 架构
* **通义千问 (Qwen) 系列** 架构
* **混合专家模型 (MoE)** 架构

### ⚙️ 自动化负载配置

我们提供了一个 Python 脚本，用于快速生成参数化的工作负载配置。脚本路径：
`${WAFERAI_SIM_ROOT}/llm/test/tool_script/workload_autogen.py`

**使用方法：**
您可以直接运行该脚本并参考其中定义的参数。目前支持的配置参数如下：

| 参数 | 描述 | 默认值 |
| --- | --- | --- |
| `output_dir` | 输出目录 | `./test` |
| `output_name` | 输出文件名 | `config.json` |
| `B` | Batch Size (批大小) | `1` |
| `T` | 平均输入长度 | `256` |
| `DH` | Head Dimension (头维度) | `128` |
| `NH` | Head Number (头数量) | `32` |
| `KVH` | KV Head Number | `8` |
| `HS` | Hidden Size (隐藏层大小) | `2560` |
| `L` | 模型层数 | `32` |
| `pp` | 流水线并行 (PP) 大小 | `32` |
| `dp` | 数据并行 (DP) 大小 | `1` |
| `tp` | 张量并行 (TP) 大小 | `1_1` (mn_dim_k_dim) |
| `IS` | Intermediate Size (中间层大小) | `9728` |
| `avg_output` | 平均输出长度 | `50` |
| `model` | 模型架构 | `gpt` (可选: `gpt` 或 `qwen`) |

---

## 🚀 快速上手

使用预定义的 LLM 测试配置运行仿真：

```bash
./npusim \
    --workload-config ../llm/test/workload_config/gpu/pd_serving.json \
    --simulation-config ../llm/test/simulation_config/default_spec.json \
    --hardware-config ../llm/test/hardware_config/core_4x4.json \
    --mapping-config ../llm/test/mapping_config/default_mapping.txt

```

---

## 📜 引用信息

如果 WaferAI-SIM 对您的研究有所帮助，请引用我们的工作：

```bibtex
@misc{waferai-sim,
      title={From Principles to Practice: A Systematic Study of LLM Serving on Multi-core NPUs}, 
      author={Tianhao Zhu and Dahu Feng and Erhu Feng and Yubin Xia},
      year={2025},
      eprint={2510.05632},
      archivePrefix={arXiv},
      primaryClass={cs.AR},
      url={https://arxiv.org/abs/2510.05632}, 
}

```
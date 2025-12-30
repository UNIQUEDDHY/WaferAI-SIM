<div align="center">
<picture>
<img alt="WaferAI-SIM" src="doc/images/logo.png" width=50%>
</picture>
</div>

<h3 align="center">
🚀 WaferAI-SIM: A Lightweight and Multi-Level Simulation Framework for Multi-Core NPUs
</h3>

<p align="center">
| <a href="[https://npu-sim.readthedocs.io/zh-cn/latest/](https://npu-sim.readthedocs.io/zh-cn/latest/)"><b>📖 Documentation</b></a> | <a href="[https://github.com/user-attachments/assets/16d4f604-30a7-43bc-a2e8-a6a776718708](https://github.com/user-attachments/assets/16d4f604-30a7-43bc-a2e8-a6a776718708)"><b>🎬 Demo Video</b></a> |
</p>

<p align="center">
<strong>English</strong> | <a href="README_CN.md">中文</a>
</p>

---

## 💡 About

**WaferAI-SIM** is a lightweight, large-scale, and multi-level simulation framework designed for multi-core Neural Processing Units (NPUs). It provides powerful system-level analysis capabilities for large-scale models, such as Large Language Models (LLMs). 🛠️

* **🧩 Flexible Parallelism:** Exploration of various tensor parallelism strategies.
* **📍 Customizable Core Placement:** Support for user-defined core placement policies.
* **💾 Advanced Memory Management:** Simulation of diverse memory management methods.
* **🔄 Configurable Dataflow:** Selection between PD-disaggregation and PD-fusion.

**System Architecture:**

<div align="center">
<p align="center">
<img src="doc/images/arch.png" width="80%"/>
</p>
</div>

---

## ✨ Key Features

* **🔬 Multi-Level Simulation:** Supports both transaction-level and performance-model-based simulation.
* **🏗️ Wafer-Scale Modeling:** Enables analysis of next-generation hardware using hybrid bonding and distributed memory architectures.
* **📊 Real-time Visualization:** Features an interactive GUI for monitoring the simulation process.

## 🎬 Demo

**GUI Visualization**:

[gui-video.mp4](gui-video.mp4)

---

## 🛠️ Installation

We provide a Docker-based environment to ensure a consistent build and runtime environment. 🐳

### 1. Build Image

The building process takes approximately **3 minutes**.

```bash
docker build -t waferai-sim:latest .
```

### 2. Run Container

Launch the interactive container:

```bash
docker run -it waferai-sim:latest
```

### 3. Execution

After entering the container, you can find the executable file `npusim` in the current directory.

---

## 🤖 Model Support & Configuration

**WaferAI-SIM** is designed with a comprehensive automation toolchain to simplify the configuration process for large-scale model simulations. ⚡

### 📝 Supported Model Architectures

The framework natively supports various mainstream LLM architectures, enabling precise simulation of operator behavior and dataflows for:

* **LLAMA Series** (Llama-2/3, 7B to 70B)
* **GPT Series** architectures
* **Qwen Series** architectures
* **Mixture of Experts** architectures

### ⚙️ Automated Workload Configuration

A Python script is provided to enable rapid parameterized generation of workloads. The script is located at:
`${WAFERAI_SIM_ROOT}/llm/test/tool_script/workload_autogen.py`

**Usage:**
You can run the script directly and refer to the parameters defined within. The currently supported configuration parameters are as follows:

| Parameter | Description | Default Value |
| --- | --- | --- |
| `output_dir` | Output directory | `./test` |
| `output_name` | Output file name | `config.json` |
| `B` | Batch size | `1` |
| `T` | Average input length | `256` |
| `DH` | Head dimension | `128` |
| `NH` | Head number | `32` |
| `KVH` | KV head number | `8` |
| `HS` | Hidden size | `2560` |
| `L` | Model layers | `32` |
| `pp` | PP (Pipeline Parallelism) size | `32` |
| `dp` | DP (Data Parallelism) size | `1` |
| `tp` | TP (Tensor Parallelism) size | `1_1` (mn_dim_k_dim) |
| `IS` | Intermediate size | `9728` |
| `avg_output` | Average output length | `50` |
| `model` | Model architecture | `gpt` (Options: `gpt` or `qwen`) |

---

## 🚀 Quick Start

Run a simulation using the pre-defined LLM test configs:

```bash
./npusim \
    --workload-config ../llm/test/workload_config/gpu/pd_serving.json \
    --simulation-config ../llm/test/simulation_config/default_spec.json \
    --hardware-config ../llm/test/hardware_config/core_4x4.json \
    --mapping-config ../llm/test/mapping_config/default_mapping.txt
```

---

## 📜 Citation

If you find WaferAI-SIM useful in your research, please cite our work:

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
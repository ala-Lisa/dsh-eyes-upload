<div align="center">

# DSH Eyes Upload

### 上传图片，自动用 deepseek-eyes 分析，随下一条消息发给模型

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: DeepSeek Harness](https://img.shields.io/badge/Platform-DSH-1677ff.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Vision: Qwen3-VL](https://img.shields.io/badge/Vision-Qwen3--VL-2ea44f.svg)](https://modelscope.cn)
[![Skill: deepseek-eyes](https://img.shields.io/badge/Skill-deepseek--eyes-f97316.svg)](./SKILL.md)

**不弹窗、不写输入框、不打断聊天。**

</div>

## 为什么做这件事

DeepSeek 等文本模型看不了图，DSH 会在消息发给模型前拒绝带图片的消息：

> 当前模型不支持图片，请切换支持图片的模型

本插件绕开这条检查：图片先经 deepseek-eyes（Qwen3-VL，ModelScope 免费 API）分析成文字，再随消息注入。模型收到的是一份它读得懂的描述。

## 它解决了什么问题

- 模型看不了图：上传的图片先分析成文字再进消息
- 上传被拒：分析文本随消息注入，不走图片能力检查
- 交互干扰：无弹窗、不动输入框，按钮只显示「分析中…」→「已上传」
- 顺序混乱：「已传 N 张」列表按序编号，可单张删除
- 换会话丢能力：deepseek-eyes 技能随插件全局注册

## 它是怎么工作的

```
                    ┌─────────────┐
  点「传图」按钮 ──▶ │  保存图片    │
  或 Ctrl+V 粘贴  │  ~/.dsh/eyes- │
  （可多张）      │  uploads/     │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ deepseek-eyes│  Qwen3-VL 逐张分析
                    │ 自动分析     │  （按钮显示 1/n 进度）
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │ 分析挂起     │  页面只显示「已上传」
                    │ （按会话）   │
                    └──────┬──────┘
                           ▼
  你正常发消息 ──▶ ┌─────────────┐
                    │ agent/pre-step│  主机在模型步骤前
                    │ 自动注入     │  把分析附到你的消息里
                    └──────┬──────┘
```

- 分析只随下一条真实消息注入一次，之后清空
- 注入内容含每张图的名称、描述、保存路径，模型可对同一路径做 OCR、代码提取等后续处理
- 一次可传任意张数，顺序 = 选择/粘贴的顺序

## 安装

前置：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)、`pnpm`、deepseek-eyes 的
Python 环境（venv 内 `mcp>=1.0.0,<2.0.0`、`openai<3.0.0`、`Pillow`、`aiofiles`）。

```sh
dsh plugin --profile web add git+https://github.com/ala-Lisa/dsh-eyes-upload.git
# 重启 dsh web + 浏览器硬刷新(Ctrl+F5)
```

## 配置

优先级：cordis 行 config > 环境变量 > 默认值。

**1. cordis 行 config**（编辑 `cordis.patch.yml`）

```yaml
- insert:
    - id: eyes-upload
      name: dsh-eyes-upload
      config:
        apiKey: your-modelscope-key-without-ms-prefix
        python: /path/to/deepseek-eyes/.venv/bin/python
        repoDir: /path/to/deepseek-eyes-pack
        uploadDir: /path/to/eyes-uploads
```

**2. 环境变量**（密钥不进仓库）

```sh
export EYES_API_KEY=your-modelscope-key-without-ms-prefix
export EYES_PYTHON=/path/to/deepseek-eyes/.venv/bin/python
export EYES_REPO_DIR=/path/to/deepseek-eyes-pack
export EYES_UPLOAD_DIR=/path/to/eyes-uploads
```

**3. 不配置**：回退默认（`python3` / 当前目录 / 插件目录下 `uploads/`）。

API Key：https://modelscope.cn 注册 → 个人中心 → 访问令牌（首次需绑定阿里云账号）。
令牌形如 `ms-xxxxxxxx`，使用时去掉 `ms-` 前缀。免费 500 次/天。

## 功能清单

| 能力 | 说明 |
|------|------|
| 🖼️ 传图按钮 | 输入框工具行，样式与 DSH 原生按钮一致 |
| 📋 粘贴截图 | 页面内 Ctrl+V 直接拦截粘贴的图片，多张不限量 |
| 🧾 已传胶囊 | 「已传 N 张」悬停展开列表，按序编号、单张 ✕ 删除 |
| 🫥 隐性注入 | `agent/pre-step` 注入，随下一条消息到达后清空 |
| 📚 技能随包 | deepseek-eyes 技能在插件加载时全局注册 |
| 🗂️ 落盘可查 | 图片存 `uploads/`，支持事后 OCR/代码提取 |
| 🛡️ 安全校验 | 仅图片格式（魔数校验）、单张 ≤20MB、超 2048×2048 自动缩放 |

## 仓库结构

```text
dsh-eyes-upload/
├── README.md              ← 你正在看的
├── LICENSE                ← MIT
├── SKILL.md               ← deepseek-eyes 技能(随包注册)
├── cordis.patch.yml       ← 组合行
├── package.json           ← dsh.bundle + dsh.client 声明
└── lib/
    ├── index.js           ← host:上传/删除路由、pre-step 注入、技能注册
    ├── analyze.py         ← 分析脚本
    └── client.js          ← client:按钮、粘贴拦截、已传列表
```

## 依赖与兼容

- 主机：DSH Web 组合（`conversation.input.left` 插槽、`webServer`、`skills`、`agent/pre-step`）
- 视觉：[deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes)（Qwen3-VL via ModelScope）
- 客户端：无第三方运行依赖

## ⭐ Star History

<a href="https://www.star-history.com/?repos=ala-Lisa%2Fdsh-eyes-upload&type=date&legend=top-left">
 <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ala-Lisa%2Fdsh-eyes-upload&type=date" />
</a>

## License

MIT. See [LICENSE](./LICENSE).

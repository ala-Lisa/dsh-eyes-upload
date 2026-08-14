<div align="center">

# DSH Eyes Upload 🖼️👁

### 给没有视觉能力的文本模型，装上一双"隐性"的眼睛

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: DeepSeek Harness](https://img.shields.io/badge/Platform-DSH-1677ff.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Vision: Qwen-VL](https://img.shields.io/badge/Vision-Qwen3--VL-2ea44f.svg)](https://modelscope.cn)
[![Skill: deepseek-eyes](https://img.shields.io/badge/Skill-deepseek--eyes-f97316.svg)](./SKILL.md)

**传图 / 粘贴截图，剩下的交给 deepseek-eyes 自动完成——不弹窗、不写输入框、不打断聊天。**

</div>

## 为什么做这件事

DeepSeek 等文本模型很强，但**看不了图**。DSH 的输入框虽然支持图片附件，但消息在发给模型前会被能力检查拦下，弹出一句冷冰冰的：

> 当前模型不支持图片，请切换支持图片的模型

于是你只能：把图片存到磁盘 → 手动告诉 AI 路径 → AI 自己想办法调视觉工具 → 你还要在一堆结果里找它到底看没看懂。整个链路又绕又碎。

这个插件把整条链路压成一步：**你传图，它静默分析，你发消息时分析自动随消息到达**。你甚至不用知道自己"用了" deepseek-eyes——它只是默默地让模型看懂了你的图。

## 它解决了什么问题

- **模型看不了图**：上传的图片先经 deepseek-eyes（通义千问 Qwen3-VL，ModelScope 免费 API，500 次/天）分析成文字，模型看到的是一份它读得懂的描述
- **上传被拒**：绕开 DSH 的图片能力准入检查——图片根本不以图片形态进入消息，而是以分析文本随消息注入
- **交互太吵**：没有弹窗、没有结果卡片、不往输入框里塞文字——按钮只短暂显示「分析中…」→「已上传」
- **传完就忘顺序**：按钮旁的「已传 N 张」胶囊悬停即展开（DSH 原生菜单样式），每张按顺序编号、可单独 ✕ 删除
- **换会话就丢能力**：`deepseek-eyes` 技能随插件**全局注册**，任何预设的会话都自动懂这套玩法

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
                    │ （按会话）   │  不弹窗、不动输入框
                    └──────┬──────┘
                           ▼
  你正常发消息 ──▶ ┌─────────────┐
                    │ agent/pre-step│  主机在模型步骤前
                    │ 自动注入     │  把分析附到你的消息里
                    └──────┬──────┘
                           ▼
                    模型"看到"了图 🎉
```

关键设计：

- 分析结果只在**你下一条真实消息**到达时附带一次，之后自动清空——不会每轮重复
- 附带的分析里包含每张图的**名称、描述、保存路径**，模型可以对同一路径做更精细的后续处理（OCR、代码还原、图表解读……）
- 一次可传**任意张数**，顺序 = 你选择/粘贴的顺序

## 安装

前置：已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 与 `pnpm`；本机已有
[deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes) 的 Python 环境（venv 内
`mcp>=1.0.0,<2.0.0`、`openai<3.0.0`、`Pillow`、`aiofiles`）。

```sh
dsh plugin --profile web add git+https://github.com/ala-Lisa/dsh-eyes-upload.git
# 重启 dsh web 服务 + 浏览器硬刷新(Ctrl+F5)
```

## 配置

三种方式任选（优先级从高到低）：

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

**2. 环境变量**（推荐，密钥不进仓库）

```sh
export EYES_API_KEY=your-modelscope-key-without-ms-prefix
export EYES_PYTHON=/path/to/deepseek-eyes/.venv/bin/python
export EYES_REPO_DIR=/path/to/deepseek-eyes-pack
export EYES_UPLOAD_DIR=/path/to/eyes-uploads
```

**3. 不配置**：代码回退默认（`python3` / 当前目录 / 插件目录下 `uploads/`）。

API Key 获取：https://modelscope.cn 注册 → 个人中心 → 访问令牌（首次需绑定阿里云账号）。
令牌形如 `ms-xxxxxxxx`，**使用时去掉 `ms-` 前缀**。

## 功能清单

| 能力 | 说明 |
|------|------|
| 🖼️ 传图按钮 | 输入框工具行，样式与 DSH 原生按钮一致（含悬停态、主题变量配色） |
| 📋 粘贴截图 | 页面内 Ctrl+V 直接拦截粘贴的图片，多张不限量 |
| 🧾 已传胶囊 | 「已传 N 张」悬停淡入列表（DSH 原生菜单配方），按序编号、单张 ✕ 删除 |
| 🫥 隐性注入 | `agent/pre-step` 事件注入，来源 `eyes-upload`，随下一条消息到达后清空 |
| 📚 技能随包 | `deepseek-eyes` 技能在插件加载时全局注册，任何预设会话可用 |
| 🗂️ 落盘可查 | 图片存 `uploads/`（文件名带时间戳），支持事后 OCR/代码提取等二次分析 |
| 🛡️ 安全校验 | 仅图片格式（魔数校验）、单张 ≤20MB、超 2048×2048 自动等比缩放 |

## 仓库结构

```text
dsh-eyes-upload/
├── README.md              ← 你正在看的
├── LICENSE                ← MIT
├── SKILL.md               ← 随包注册的 deepseek-eyes 技能
├── cordis.patch.yml       ← 组合层:插入 eyes-upload 行(无密钥,配置走环境变量)
├── package.json           ← dsh.bundle + dsh.client 声明
└── lib/
    ├── index.js           ← host:上传/删除路由、隐性分析、技能注册、pre-step 注入
    ├── analyze.py         ← 调 deepseek-eyes VisionClient 的分析脚本
    └── client.js          ← client:传图按钮、粘贴拦截、已传胶囊与悬停菜单
```

## 依赖与兼容

- **主机**：DSH Web 组合（`conversation.input.left` 插槽、`webServer`、`skills` 服务、`agent/pre-step` 事件）
- **视觉**：[deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes)（Qwen3-VL via ModelScope）
- **客户端**：仅依赖 DSH 客户端插槽与主题变量，无第三方运行依赖

## ⭐ Star History

如果这个项目帮到了你，点个 Star 支持一下～

<a href="https://www.star-history.com/?repos=ala-Lisa%2Fdsh-eyes-upload&type=date&legend=top-left">
 <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=ala-Lisa%2Fdsh-eyes-upload&type=date" />
</a>

## License

MIT. See [LICENSE](./LICENSE).

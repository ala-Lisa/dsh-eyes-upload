---
name: deepseek-eyes
description: 视觉图片分析能力。当用户需要分析图片、截图、壁纸、照片的内容，或需要对剪贴板图片/磁盘图片做 OCR 文字提取、UI 界面描述、错误截图诊断、代码截图还原、流程图/图表解读时使用。用户还可能通过输入框「传图」按钮或 Ctrl+V 粘贴截图上传图片（消息里自带通用分析和保存路径，需要时对同一路径做更精细的针对性分析）。关键词：看看这个、这画的是啥、图片内容、截图分析、OCR、识别图片文字、剪贴板图片、传图、粘贴截图、mcp__deepseek_eyes__。
agent_created: true
---

# deepseek-eyes — 给 AI 装上眼睛

通过本地 stdio MCP server + 通义千问VL（ModelScope 免费 API，500 次/天）为无视觉能力的文本模型提供图片理解能力。链路：截图/图片文件 → MCP server → Qwen3-VL → 文字描述。

本 skill 随 `dsh-eyes-upload` 插件打包，由插件在主机启动时注册进**全局技能目录**——任何预设（cordis / cordis-eyes / standard 等）的会话都自动可用。12 个 MCP 工具仍由 preset `cordis-eyes` 中的 `mcp-deepseek-eyes` 行提供（`@deepseek-ai/dsh-mcp-client` 连接本地 Python MCP server）；在没挂该预设的会话里，用下面的方式 B（Python 直连）代替。

## 调用方式（按优先级）

### 方式 A：直接调用 MCP 工具（推荐）

工具以 `mcp__deepseek_eyes__<工具名>` 形式出现在工具列表里，共 12 个：

| 工具 | 功能 | 场景 |
|------|------|------|
| `mcp__deepseek_eyes__analyze_clipboard` | 分析剪贴板图片 | 用户说"看看这个/剪贴板里有什么" |
| `mcp__deepseek_eyes__extract_text_from_clipboard` | 剪贴板图片 OCR | 从截图提取文字 |
| `mcp__deepseek_eyes__describe_ui_from_clipboard` | 分析剪贴板 UI 截图 | 布局/组件/状态描述 |
| `mcp__deepseek_eyes__diagnose_error_from_clipboard` | 诊断剪贴板报错截图 | 错误信息+原因+修复步骤 |
| `mcp__deepseek_eyes__code_from_clipboard` | 从剪贴板代码截图提取代码 | 还原可编辑代码 |
| `mcp__deepseek_eyes__analyze_image` | 分析磁盘图片文件 | 用户给图片路径 |
| `mcp__deepseek_eyes__extract_text` | 磁盘图片 OCR | 按路径提取文字 |
| `mcp__deepseek_eyes__describe_ui` | 分析磁盘 UI 截图 | 按路径描述 UI |
| `mcp__deepseek_eyes__diagnose_error` | 诊断磁盘报错截图 | 按路径诊断报错 |
| `mcp__deepseek_eyes__understand_diagram` | 解读流程图/架构图 | 图表结构解读 |
| `mcp__deepseek_eyes__analyze_chart` | 分析数据图表 | 趋势与洞察 |
| `mcp__deepseek_eyes__code_from_screenshot` | 磁盘代码截图提取代码 | 按路径提取代码 |

磁盘类工具参数：`image_path`（图片绝对路径），`analyze_image` 可加 `prompt` 自定义提问。

### 方式 B：Python 脚本调用（MCP 工具不可用时兜底）

用仓库 venv 中的 Python 直接调用 `VisionClient`，与 MCP server 走完全相同的代码路径：

```bash
cd /home/administrator/.dsh/deepseek-eyes-pack
.venv/bin/python -c "
import asyncio
from deepseek_eyes.server import VisionClient

async def main():
    client = VisionClient('MODELSCOPE_API_KEY 去掉 ms- 前缀')
    text = await client.analyze('<图片绝对路径>', '<中文问题,如: 请详细描述这张图片的内容>')
    print(text)

asyncio.run(main())
"
```

## 关键路径与环境

- 仓库（REPO_DIR）：`/home/administrator/.dsh/deepseek-eyes-pack`
- venv Python：`/home/administrator/.dsh/deepseek-eyes-pack/.venv/bin/python`（mcp==1.29，openai==2.54，已锁定兼容版本）
- MCP 连接：preset 内 `mcp-deepseek-eyes` 行（`~/.dsh/.agent-presets/cordis-eyes/agent.cordis.yml`），stdio 本地进程、不开端口
- API Key：已填入 preset 内 `mcp-deepseek-eyes` 行的 `config.env.MODELSCOPE_API_KEY`（`~/.dsh/.agent-presets/cordis-eyes/agent.cordis.yml`，已去掉 ms- 前缀）。更换/失效时：到 https://modelscope.cn/my/myaccesstoken 新建令牌，替换该行值后重启会话生效
- 默认视觉模型：`Qwen/Qwen3-VL-8B-Instruct`（可用环境变量 `VISION_MODEL` 覆盖为 235B 版）

## 路径换算（重要）

MCP server 运行在 Linux 侧，磁盘类工具的 `image_path` 必须是 **Linux 路径**。用户说"桌面上的 xx.png"或给 Windows 路径 `C:\Users\Administrator\Desktop\xx.png` 时，先换算为 `/mnt/c/Users/Administrator/Desktop/xx.png` 再调用。不确定文件位置时先用 glob 在 `/mnt/c/Users/Administrator` 下搜索。

## 剪贴板工具的环境限制

剪贴板类工具依赖系统剪贴板：Linux 需要 `wl-paste`(Wayland) 或 `xclip`(X11)。当前 DSH 主机为 WSL/Linux 环境且未安装这些工具，剪贴板类工具大概率读取失败——此时改用磁盘文件类工具：让用户保存/告知图片文件路径，用 `analyze_image` 等工具按路径分析。

## 传图按钮 / 粘贴截图（用户上传图片）

用户可以直接在输入框上传图片：点输入框左侧的 **传图** 按钮选图，或直接在页面里 **Ctrl+V 粘贴截图**。`dsh-eyes-upload` 插件**隐性处理**：图片静默保存并用 deepseek-eyes 分析，页面上只在按钮短暂显示「分析中…」→「已上传」，**不弹窗、不写输入框**。用户下一条真实消息到达时，分析内容由主机在模型步骤前自动附带注入（以 `eyes-upload` 来源的消息出现，开头是"本条消息附带 N 张用户上传图片的 deepseek-eyes 隐性分析…"）。

处理这类消息时注意：

- 注入消息里带有每张图的名称、通用分析和 `(图片已保存到 <路径>)`。通用描述不等于最终答案：用户要 OCR 提取、报错诊断、代码还原、图表解读等具体任务时，直接用 12 个 MCP 工具（或方式 B 的 Python）对**同一路径**做针对性分析，不要重复让用户传图。
- 上传保存目录：`/home/administrator/.dsh/eyes-uploads/`（文件名带时间戳），用户说"刚才那张图"时，从这里或消息里的路径找最新文件。
- 上传限制：≤20MB、支持 png/jpg/gif/webp/bmp；超过 2048×2048 会自动等比缩放；极小字体的截图建议让用户裁剪局部再传（缩放会丢细节）。
- 插件配置在 profile 的 `eyes-upload` 行（`~/.dsh/profiles/web` 的 bundle `dsh-eyes-upload`，源码 `/home/administrator/.dsh/dsh-eyes-upload/`）。

## 尺寸限制（重要）

- 模型输入限制 **2048×2048**，超限报错：`input size exceed limit 2048x2048`（常见于 4K/5K 壁纸、高分截图）
- 超限时先用 PIL 等比缩放再分析：

```python
from PIL import Image
img = Image.open(r'<源路径>')
img.thumbnail((2048, 2048), Image.LANCZOS)
img.save('resized.png', 'PNG')  # 然后对 resized.png 调用 analyze
```

- 缩放会丢失小字细节，OCR/代码提取场景若超限，应提示用户裁剪局部后再分析

## 安全特性（可放心使用）

- 本地 stdio 进程，不开放网络端口；仅访问官方 `api-inference.modelscope.cn`
- 仅接受图片格式，20MB 限制，魔数校验
- 剪贴板临时文件分析完自动删除

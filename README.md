# dsh-eyes-upload

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform: DSH](https://img.shields.io/badge/Platform-DSH-1677ff.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Vision: Qwen3-VL](https://img.shields.io/badge/Vision-Qwen3--VL-2ea44f.svg)](https://modelscope.cn)

DSH 插件：输入框加「传图」按钮，支持 Ctrl+V 粘贴截图。图片静默保存并用 deepseek-eyes（Qwen3-VL via ModelScope）分析，你下一条消息发送时分析自动附带注入——不弹窗、不写输入框。

`deepseek-eyes` 技能随包全局注册。

## 安装

前置：DSH、`pnpm`、deepseek-eyes 的 Python 环境（venv 内 `mcp>=1.0.0,<2.0.0`、`openai<3.0.0`、`Pillow`、`aiofiles`）。

```sh
dsh plugin --profile web add git+https://github.com/ala-Lisa/dsh-eyes-upload.git
# 重启 dsh web + Ctrl+F5
```

## 配置

优先级：cordis 行 config > 环境变量 > 默认值。

| 项 | config 字段 | 环境变量 | 默认 |
|---|---|---|---|
| ModelScope Key（去 `ms-` 前缀） | `apiKey` | `EYES_API_KEY` | — |
| Python | `python` | `EYES_PYTHON` | `python3` |
| deepseek-eyes 目录 | `repoDir` | `EYES_REPO_DIR` | 当前目录 |
| 上传目录 | `uploadDir` | `EYES_UPLOAD_DIR` | 插件目录 `/uploads` |

Key 获取：https://modelscope.cn → 个人中心 → 访问令牌（首次需绑定阿里云账号），去掉 `ms-` 前缀。免费 500 次/天。

## 行为

- 传图按钮 + Ctrl+V 粘贴，多张不限量，按序逐张分析（按钮显示 `i/n` 进度）
- 上传后按钮旁显示「已传 N 张」，悬停展开列表，可单张删除
- 分析随下一条用户消息注入一次后清空；图片落盘，可二次 OCR/代码提取
- 仅收图片格式（魔数校验）、单张 ≤20MB、超 2048×2048 自动等比缩放

## 目录

```text
dsh-eyes-upload/
├── README.md
├── LICENSE
├── SKILL.md            # deepseek-eyes 技能(随包注册)
├── cordis.patch.yml    # 组合行
├── package.json
└── lib/
    ├── index.js        # host:上传/删除路由、pre-step 注入、技能注册
    ├── analyze.py      # 分析脚本
    └── client.js       # client:按钮、粘贴拦截、已传列表
```

## License

MIT

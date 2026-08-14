# dsh-eyes-upload 🖼️👁

DeepSeek Harness (DSH) 插件：给没有视觉能力的文本模型"装上眼睛"。

在输入框左侧加一个 **传图** 按钮（也支持直接 **Ctrl+V 粘贴截图**），图片静默保存并用
[deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes)（通义千问 Qwen-VL，ModelScope
免费 API）自动分析；页面只显示「已上传」，你下一条消息发送时，分析结果由主机在模型步骤前
**自动附带注入**——完全不写输入框、不弹窗、不打断聊天。

随包还附带 `deepseek-eyes` 技能（SKILL.md），插件加载时自动注册进全局技能目录，任何预设的
会话都可用。

## 功能

- 🖼️ 输入框工具行「传图」按钮（样式与 DSH 原生按钮一致，含悬停态）
- 📋 Ctrl+V 直接粘贴截图（多张不限数量，逐张分析，按钮显示 `i/n` 进度）
- 🧾 上传后按钮旁显示「已传 N 张」胶囊：悬停淡入列表（DSH 原生菜单样式），每张可 ✕ 删除
- 🫥 隐性分析：结果随用户下一条消息自动附带（`agent/pre-step` 注入，来源 `eyes-upload`）
- 📚 自带 `deepseek-eyes` 技能，全局注册（模型知道如何对同一路径做 OCR/代码提取/图表解读等后续处理）
- 🧭 上传图片存盘（默认 `<插件目录>/uploads`），可随时对历史图片做进一步分析

## 安装

前置：已安装 [DSH](https://github.com/deepseek-ai/deepseek-harness) 与 `pnpm`。

```sh
dsh plugin --profile web add git+https://github.com/ala-Lisa/dsh-eyes-upload.git
# 然后重启 dsh web 并硬刷新浏览器
```

## 配置

三种方式任选（优先级从高到低）：

1. **cordis 行 config**：编辑 `cordis.patch.yml` 的 `eyes-upload` 行：

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

2. **环境变量**（推荐，密钥不进仓库）：

   ```sh
   export EYES_API_KEY=your-modelscope-key-without-ms-prefix
   export EYES_PYTHON=/path/to/deepseek-eyes/.venv/bin/python
   export EYES_REPO_DIR=/path/to/deepseek-eyes-pack
   export EYES_UPLOAD_DIR=/path/to/eyes-uploads
   ```

3. 不配置：代码默认 `python3`、cwd 为分析脚本工作目录、上传目录为插件目录下 `uploads/`。

API Key 获取：https://modelscope.cn 注册 → 个人中心 → 访问令牌（首次需绑定阿里云账号），
令牌形如 `ms-xxxxxxxx`，**使用时去掉 `ms-` 前缀**。免费 500 次/天。

## 依赖

- 本机装有 [deepseek-eyes](https://github.com/Shaohan-He/deepseek-eyes) 的 Python 环境
  （venv 内 `mcp>=1.0.0,<2.0.0`、`openai<3.0.0`、`Pillow`、`aiofiles`，脚本会自动对超
  2048×2048 的图等比缩放）
- DSH Web 组合（`conversation.input.left` 插槽、`webServer`、`skills`、`agent/pre-step` 事件）

## 目录结构

```
dsh-eyes-upload/
├── cordis.patch.yml     # 组合层:插入 eyes-upload 行
├── package.json         # dsh.bundle + dsh.client 声明
├── SKILL.md             # 随包注册的 deepseek-eyes 技能
└── lib/
    ├── index.js         # host:上传/删除路由 + 隐性分析 + 技能注册 + pre-step 注入
    ├── analyze.py       # 调 deepseek-eyes VisionClient 的脚本
    └── client.js        # client:传图按钮、粘贴拦截、已传列表、悬停菜单
```

## License

MIT

"""deepseek-eyes 分析脚本:用法 python analyze.py <图片路径>

用仓库 venv 里的 VisionClient(与 MCP server 相同代码路径)分析图片,
超 2048×2048 先用 PIL 等比缩放。stdout 输出描述文本。
"""
import asyncio
import os
import sys

from PIL import Image
from deepseek_eyes.server import VisionClient

PROMPT = (
    "请详细描述这张图片的全部内容:画面元素、布局、风格,并尽量原样读出图中所有文字。"
    "如果这是一张截图或界面,请说明它展示的是什么软件/页面以及当前状态。"
)


async def main() -> None:
    if len(sys.argv) < 2:
        print("usage: analyze.py <image_path>")
        sys.exit(2)
    path = sys.argv[1]
    img = Image.open(path)
    if max(img.size) > 2048:
        img.thumbnail((2048, 2048), Image.LANCZOS)
        tmp = path + ".resized.png"
        img.save(tmp, "PNG")
        path = tmp
    client = VisionClient(os.environ["MODELSCOPE_API_KEY"])
    print(await client.analyze(path, PROMPT))


if __name__ == "__main__":
    asyncio.run(main())

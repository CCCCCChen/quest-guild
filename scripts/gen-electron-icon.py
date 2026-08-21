#!/usr/bin/env python3
"""生成 Electron 安装包图标（占位，后续可替换为真实设计稿）。

配色呼应 quest-guild 设计系统：暖米底 + 鼠尾草绿 + 珊瑚强调。
输出：
  quest-guild-electron/assets/icon.png  (512x512 透明)
  quest-guild-electron/assets/icon.ico  (16/32/48/256 多分辨率)
运行：managed venv 的 python scripts/gen-electron-icon.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "quest-guild-electron", "assets")
os.makedirs(OUT, exist_ok=True)

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

SAGE = (133, 169, 107, 255)       # 鼠尾草绿
CORAL = (232, 145, 107, 255)      # 珊瑚强调
CREAM = (245, 239, 230, 255)      # 暖米


def shield_points(cx, top, w, h):
    left = cx - w // 2
    right = cx + w // 2
    shoulder = top + int(h * 0.62)
    return [
        (left, top),
        (right, top),
        (right, shoulder),
        (cx, top + h),        # 尖端
        (left, shoulder),
    ]


cx = S // 2
# 外层盾牌（绿色填充）
d.polygon(shield_points(cx, 70, 380, 400), fill=SAGE)
# 内层珊瑚描边（略小盾牌闭合描边）
inner = shield_points(cx, 90, 344, 364)
d.line(inner + [inner[0]], fill=CORAL, width=16)

# 中心大对勾（任务完成）
r = 150
p1 = (cx - int(r * 0.55), 252)
p2 = (cx - int(r * 0.10), 300)
p3 = (cx + int(r * 0.62), 196)
d.line([p1, p2, p3], fill=CREAM, width=34)

png = os.path.join(OUT, "icon.png")
img.save(png)
ico = os.path.join(OUT, "icon.ico")
img.save(ico, sizes=[(16, 16), (32, 32), (48, 48), (256, 256)])
print("wrote", png, ico)

#!/usr/bin/env python3
"""
背景图片加工脚本（增量模式）

用法:
  python3 process_images.py <原图目录> <输出目录>

  原图目录: 存放原始高质量图片（不会被修改），建议单独目录长期保留
  输出目录: 加工后的成品（manifest.json + desktop/tablet/mobile/）

加工路径:
  原图 → 统一转RGB → 去EXIF+修正方向 → 限制分辨率 → WebP+JPG → 三档尺寸 → 输出清单

增量模式:
  - 输出目录已有 manifest.json 时，读取并合并，保留历史图片
  - 用原图内容的 MD5 作为文件名，相同图片不会重复加工
  - 新图追加到 manifest 末尾，旧图保持原有顺序
  - 孤立记录（文件已删但 manifest 还有）自动清理

输出标准:
  desktop:  长边 ≤ 1920px, WebP quality=75 / JPG quality=82
  tablet:   长边 ≤ 960px,  WebP quality=75 / JPG quality=82
  mobile:   长边 ≤ 480px,  WebP quality=75 / JPG quality=82

输出结构:
  输出目录/
  ├── desktop/    # 桌面端图
  ├── tablet/     # 平板端图
  ├── mobile/     # 手机端图
  └── manifest.json

工作流:
  1. 手机/相机拍的照片 → 丢进原图目录
  2. python3 process_images.py 原图目录 输出目录
  3. 脚本自动：跳过已加工的 → 加工新图 → 更新清单 → 清理孤立记录
  4. 原图目录永远不要删，它是质量源头
"""

import sys
import os
import io
import json
import hashlib
import shutil
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("错误: 需要安装 Pillow")
    print("  pip3 install Pillow")
    print("  或用项目 venv: .venv/bin/python scripts/process_images.py img/source img")
    sys.exit(1)

# ── 输出标准 ──────────────────────────────────────────

SIZES = {
    "desktop": 1920,
    "tablet": 960,
    "mobile": 480,
}

# WebP 质量 (0-100)
WEBP_QUALITY = 75

# JPG 质量 (0-100)
JPG_QUALITY = 82

# 支持的输入格式
INPUT_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp", ".tiff", ".tif"}

# ── 工具函数 ──────────────────────────────────────────

def file_hash(path, chunk_size=8192):
    """计算文件 MD5，用于生成唯一文件名和去重"""
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(chunk_size):
            h.update(chunk)
    return h.hexdigest()[:10]


def resize_image(img, max_long_side):
    """等比缩放，长边不超过 max_long_side"""
    w, h = img.size
    long_side = max(w, h)
    if long_side <= max_long_side:
        return img
    ratio = max_long_side / long_side
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    return img.resize((new_w, new_h), Image.LANCZOS)


def strip_exif(img):
    """去除 EXIF 隐私信息，保留方向"""
    from PIL.Image import Transpose
    try:
        exif = img.getexif()
        orientation = exif.get(274, 1)  # 274 = Orientation tag
    except Exception:
        orientation = 1

    transpose_map = {
        2: Transpose.FLIP_LEFT_RIGHT,
        3: Transpose.ROTATE_180,
        4: Transpose.FLIP_TOP_BOTTOM,
        5: Transpose.TRANSPOSE,
        6: Transpose.ROTATE_270,
        7: Transpose.TRANSVERSE,
        8: Transpose.ROTATE_90,
    }
    if orientation in transpose_map:
        img = img.transpose(transpose_map[orientation])

    return img


def load_existing_manifest(output_dir):
    """读取已有的 manifest.json"""
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        return [], set()
    try:
        with open(manifest_path, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        existing_ids = {item["id"] for item in data}
        return data, existing_ids
    except Exception:
        return [], set()


def estimate_jpg_quality(img):
    """从 JPG 量化表推算编码质量 (0-100)

    Pillow 保存 JPG 时用标准量化表 + quality 缩放。
    我们反过来：读取量化表，与标准表比较，推算 quality。
    如果无法推算，返回 None。
    """
    if img.format != "JPEG":
        return None
    try:
        qtables = img.quantization
        if not qtables or 0 not in qtables:
            return None
        # Pillow 标准量化表 (quality=50 时的基准表)
        std_luma = [
            16, 11, 10, 16, 24, 40, 51, 61,
            12, 12, 14, 19, 26, 58, 60, 55,
            14, 13, 16, 24, 40, 57, 69, 56,
            14, 17, 22, 29, 51, 87, 80, 62,
            18, 22, 37, 56, 68,109,103, 77,
            24, 35, 55, 64, 81,104,113, 92,
            49, 64, 78, 87,103,121,120,101,
            72, 92, 95, 98,112,100,103, 99,
        ]
        actual = qtables[0]
        if len(actual) != 64:
            return None
        # 用第一个元素的比例推算 quality
        # quality > 50: scale = 200 - 2*quality
        # quality <= 50: scale = 5000 / quality
        ratio = actual[0] / std_luma[0]
        if ratio < 1.0:
            # 高质量 (>50)
            quality = int((200 - ratio * 100) / 2)
        else:
            # 低质量 (<=50)
            quality = int(5000 / (ratio * 100))
        return max(1, min(100, quality))
    except Exception:
        return None


def save_jpg_adaptive(img, path, src_quality=None):
    """自适应质量保存 JPG

    策略：先以原图 quality 保存，如果文件大小在合理范围内就不降质。
    只在文件过大时才逐步降低 quality，直到满足大小限制。

    大小限制（按档位）：
      desktop (长边≤1920): ≤ 500KB
      tablet  (长边≤960):  ≤ 200KB
      mobile  (长边≤480):  ≤ 80KB
    """
    long_side = max(img.size)

    if long_side > 1200:
        max_kb = 500
    elif long_side > 600:
        max_kb = 200
    else:
        max_kb = 80

    # 起始 quality：原图 quality，上限为 JPG_QUALITY
    start_q = min(src_quality, JPG_QUALITY) if src_quality else JPG_QUALITY
    # 最低 quality
    min_q = 50

    # 先以起始 quality 保存
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=start_q, optimize=True, progressive=True)
    size_kb = buf.tell() / 1024

    if size_kb <= max_kb:
        # 文件大小已达标，直接保存
        with open(path, "wb") as f:
            f.write(buf.getvalue())
        return start_q, size_kb

    # 文件过大，逐步降 quality
    quality = start_q
    while quality > min_q and size_kb > max_kb:
        quality = max(quality - 5, min_q)
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        size_kb = buf.tell() / 1024

    with open(path, "wb") as f:
        f.write(buf.getvalue())
    return quality, size_kb


def process_file(input_path, output_dir, base_name=None):
    """处理单个文件，返回 manifest 条目

    策略：
    - 如果原图尺寸 ≤ 目标档位尺寸，且原图是 JPG：直接复制，不重编码（零质量损失）
    - 如果原图尺寸 > 目标档位尺寸：缩放后编码
    - WebP 始终生成（格式转换必须编码，但质量独立控制）
    - 非 JPG 格式（PNG/HEIC等）：始终编码为 JPG
    - 重编码 JPG 时：先以原图 quality 保存，文件大小达标就不降质；过大才逐步降低 quality
    """
    import shutil

    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"  [跳过] 无法打开: {input_path.name} ({e})")
        return None

    need_encode = img.mode in ("RGBA", "P", "LA") or input_path.suffix.lower() not in (".jpg", ".jpeg")

    if img.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # EXIF 方向修正是像素级操作，必须重编码
    from PIL.Image import Transpose
    try:
        exif = img.getexif()
        orientation = exif.get(274, 1)
    except Exception:
        orientation = 1
    transpose_map = {
        2: Transpose.FLIP_LEFT_RIGHT,
        3: Transpose.ROTATE_180,
        4: Transpose.FLIP_TOP_BOTTOM,
        5: Transpose.TRANSPOSE,
        6: Transpose.ROTATE_270,
        7: Transpose.TRANSVERSE,
        8: Transpose.ROTATE_90,
    }
    if orientation != 1 and orientation in transpose_map:
        need_encode = True
        img = img.transpose(transpose_map[orientation])

    # 推算原图 JPG quality（可能为 None）
    src_quality = estimate_jpg_quality(img)

    if base_name is None:
        base_name = file_hash(input_path)

    entry = {"id": base_name, "sizes": {}}

    for size_name, max_px in SIZES.items():
        size_dir = output_dir / size_name
        size_dir.mkdir(parents=True, exist_ok=True)

        needs_resize = max(img.size) > max_px
        resized = resize_image(img, max_px) if needs_resize else img

        # WebP：始终生成（格式转换，必须编码）
        webp_path = size_dir / f"{base_name}.webp"
        resized.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)

        # JPG：不需要缩放且不需要编码时，直接复制原图（零损失）
        jpg_path = size_dir / f"{base_name}.jpg"
        if not needs_resize and not need_encode:
            shutil.copy2(input_path, jpg_path)
            action = "复制"
            jpg_kb = input_path.stat().st_size / 1024
            out_quality = src_quality
        else:
            # 自适应质量：先以原图 quality 保存，过大才降质
            out_quality, jpg_kb = save_jpg_adaptive(
                resized, jpg_path, src_quality=src_quality
            )
            action = "缩放" if needs_resize else "转码"

        entry["sizes"][size_name] = {
            "webp": f"{size_name}/{base_name}.webp",
            "jpg": f"{size_name}/{base_name}.jpg",
            "w": resized.width,
            "h": resized.height,
            "action": action,
        }

    quality_info = f"q={src_quality}" if src_quality else "q=N/A"
    print(f"  [完成] {input_path.name} → {base_name} "
          f"({img.size[0]}x{img.size[1]}, 原图{quality_info})")
    return entry


# ── 更新 FALLBACK_IMAGES ────────────────────────────────

def update_fallback_images(manifest, bg_js_path):
    """更新 js/background.js 中的 FALLBACK_IMAGES，与 manifest.json 保持同步"""
    import re

    if not bg_js_path.exists():
        print(f"  [跳过] 未找到 {bg_js_path}")
        return

    # 从 manifest 生成 FALLBACK_IMAGES 内容
    fallback_lines = []
    for item in manifest:
        desktop = item.get("sizes", {}).get("desktop", {})
        if not desktop:
            continue
        jpg = desktop.get("jpg", "")
        webp = desktop.get("webp", "")
        fallback_lines.append(
            f"        {{ desktop: {{ jpg: '{jpg}', webp: '{webp}' }} }}"
        )

    new_fallback = "var FALLBACK_IMAGES = [\n" + ",\n".join(fallback_lines) + ",\n      ];"

    # 读取 background.js
    with open(bg_js_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 用正则替换 FALLBACK_IMAGES 块
    pattern = r'var FALLBACK_IMAGES = \[.*?\];'
    new_content = re.sub(pattern, new_fallback, content, flags=re.DOTALL)

    if new_content == content:
        print(f"  [跳过] FALLBACK_IMAGES 无需更新")
        return

    with open(bg_js_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"  [更新] FALLBACK_IMAGES → {len(fallback_lines)} 张图片")


# ── 主流程 ────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_dir.is_dir():
        print(f"错误: 输入目录不存在: {input_dir}")
        sys.exit(1)

    if input_dir.resolve() == output_dir.resolve():
        print("错误: 原图目录和输出目录不能相同")
        print("建议: 原图放 img/source/，输出放 img/")
        sys.exit(1)

    # ── 增量：加载已有 manifest ────────────────────────
    manifest, existing_ids = load_existing_manifest(output_dir)

    # 清理孤立条目
    pruned = []
    clean_manifest = []
    for item in manifest:
        webp_rel = item.get("sizes", {}).get("desktop", {}).get("webp", "")
        if webp_rel and (output_dir / webp_rel).exists():
            clean_manifest.append(item)
        else:
            pruned.append(item["id"])
    if pruned:
        print(f"清理 {len(pruned)} 条孤立记录: {', '.join(pruned)}")
        manifest = clean_manifest
        existing_ids = {item["id"] for item in manifest}

    print(f"已有图片: {len(manifest)} 张" if manifest else "首次加工")

    # 收集原图
    files = sorted([
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in INPUT_EXTS
    ])

    if not files:
        print(f"未在 {input_dir} 中找到支持的图片文件")
        sys.exit(1)

    # 筛选新图（MD5 去重）
    new_files = []
    skipped = 0
    for f in files:
        fid = file_hash(f)
        if fid in existing_ids:
            skipped += 1
        else:
            new_files.append((f, fid))

    if skipped:
        print(f"跳过 {skipped} 张已加工的图片")

    # 始终更新 FALLBACK_IMAGES（即使没有新图）
    update_fallback_images(manifest, output_dir.parent / "js" / "background.js")

    if not new_files:
        print("没有新图片需要加工")
        return

    print(f"新增 {len(new_files)} 张图片，开始加工...\n")

    for i, (f, fid) in enumerate(new_files, 1):
        print(f"[{i}/{len(new_files)}] {f.name}")
        entry = process_file(f, output_dir, base_name=fid)
        if entry:
            manifest.append(entry)

    # 写入清单
    manifest_path = output_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)

    # 统计
    print(f"\n{'='*50}")
    print(f"新增: {len(new_files)} 张, 跳过: {skipped} 张")
    print(f"总计: {len(manifest)} 张背景图")
    print(f"原图目录: {input_dir}")
    print(f"输出目录: {output_dir}")

    total = 0
    for size_name in SIZES:
        size_dir = output_dir / size_name
        if not size_dir.exists():
            continue
        size_total = sum(f.stat().st_size for f in size_dir.iterdir() if f.is_file())
        total += size_total
        print(f"  {size_name}: {len(list(size_dir.iterdir()))} 文件, "
              f"{size_total/1024:.0f}KB")
    print(f"  总计: {total/1024/1024:.1f}MB")
    print(f"\n清单文件: {manifest_path}")


if __name__ == "__main__":
    main()

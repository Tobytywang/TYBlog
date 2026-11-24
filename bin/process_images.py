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
  - 原图目录是清单的真相源：原图不在了的条目，连同它的派生文件一起移除
  - 派生文件缺失但原图还在的条目，摘掉记录后按新图重新加工补齐

输出标准:
  desktop:  长边 ≤ 1920px, WebP quality=75 / JPG quality=82
  tablet:   长边 ≤ 960px,  WebP quality=75 / JPG quality=82
  mobile:   长边 ≤ 480px,  WebP quality=75 / JPG quality=82

输出结构:
  输出目录/
  ├── desktop/    # 桌面端图
  ├── tablet/     # 平板端图
  ├── mobile/     # 手机端图
  ├── manifest.json  # 本脚本的增量状态（页面不读）
  └── manifest.js    # 页面唯一数据源：同一次运行写出，不会与 json 脱节

工作流:
  1. 手机/相机拍的照片 → 丢进原图目录
  2. python3 process_images.py 原图目录 输出目录
  3. 脚本自动：跳过已加工的 → 加工新图 → 更新清单 → 移除原图已删的条目
  4. 移除一张图：删掉原图目录里那张，重跑脚本（记录与派生文件一起消失）
  5. 原图目录永远不要删，它是质量源头
"""

import sys
import io
import json
import hashlib
import shutil
from pathlib import Path

try:
    from PIL import Image
    from PIL.Image import Transpose
except ImportError:
    print("错误: 需要安装 Pillow")
    print("  pip3 install Pillow")
    print("  或用项目 venv: .venv/bin/python bin/process_images.py img/source img")
    sys.exit(1)

# HEIC 不是 Pillow 原生支持的格式，需要额外插件。装了就用，没装则明确告知，
# 而不是等到打开文件时才抛一个看不懂的异常。
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False

# ── 输出标准 ──────────────────────────────────────────
# 一档图的所有参数写在一起：长边上限和体积上限描述的是同一件事，
# 拆到两个地方就会出现「档位改了、上限没跟上」而没人发现。
# 顺序即从大到小 —— process_file 靠这个顺序复用上一档的文件，不要重排。
SIZES = {
    "desktop": {"max_px": 1920, "max_kb": 500},
    "tablet":  {"max_px": 960,  "max_kb": 200},
    "mobile":  {"max_px": 480,  "max_kb": 80},
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


def load_existing_manifest(output_dir):
    """读取已有的 manifest.json，不存在或损坏时返回空清单"""
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        return []
    try:
        with open(manifest_path, "r", encoding="utf-8") as fp:
            return json.load(fp)
    except Exception:
        return []


def entry_files(entry):
    """一个清单条目引用的全部派生文件（相对输出目录），去重后返回

    一张图比某个档位小时，该档会复用上一档的文件（见 process_file），
    所以同一个路径可能在 desktop / tablet / mobile 里各出现一次。用 set 收敛，
    删除时才不会对同一路径 unlink 两遍（第二次会抛 FileNotFoundError）。
    """
    paths = set()
    for spec in entry.get("sizes", {}).values():
        for ext in ("webp", "jpg"):
            rel = spec.get(ext)
            if rel:
                paths.add(rel)
    return paths


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


def save_jpg_adaptive(img, path, max_kb, src_quality=None):
    """自适应质量保存 JPG

    策略：先以原图 quality 保存，如果文件大小在合理范围内就不降质。
    只在文件过大时才逐步降低 quality，直到满足大小限制。

    体积上限 max_kb 由调用方按档位传入（见 SIZES），本函数不再另立一套
    按长边推算的门槛 —— 那会与档位表脱钩。
    """
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


def process_file(input_path, output_dir, base_name):
    """处理单个文件，返回 manifest 条目

    策略：
    - 按 desktop → tablet → mobile 从大到小处理
    - 输出尺寸与上一档完全相同时（原图本来就小于该档），复用上一档文件，不再落一份字节相同的副本
    - 如果原图尺寸 ≤ 目标档位尺寸，且原图是 JPG：直接复制，不重编码（零质量损失）
    - 如果原图尺寸 > 目标档位尺寸：缩放后编码
    - WebP 始终生成（格式转换必须编码，但质量独立控制）
    - 非 JPG 格式（PNG/HEIC等）：始终编码为 JPG
    - 重编码 JPG 时：先以原图 quality 保存，文件大小达标就不降质；过大才逐步降低 quality
    """
    try:
        img = Image.open(input_path)
    except Exception as e:
        print(f"  [跳过] 无法打开: {input_path.name} ({e})")
        return None

    # 推算原图 JPG quality：必须在任何模式转换与 EXIF 转置之前读取。
    # PIL 的 convert() / transpose() 返回的是新 Image，format 与 quantization 都会丢失，
    # 之后再读只能拿到 None，自适应质量会退化成固定值。
    src_quality = estimate_jpg_quality(img)

    # 带透明通道（或调色板）的图要先铺白底；同一个判断下面还要用，只算一次
    has_alpha = img.mode in ("RGBA", "P", "LA")
    need_encode = has_alpha or input_path.suffix.lower() not in (".jpg", ".jpeg")

    if has_alpha:
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # EXIF 方向修正是像素级操作，必须重编码
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

    entry = {"id": base_name, "sizes": {}}
    prev_size = None
    prev_files = None

    for size_name, spec in SIZES.items():
        max_px = spec["max_px"]
        needs_resize = max(img.size) > max_px
        resized = resize_image(img, max_px) if needs_resize else img

        # 原图本来就小于该档，输出与上一档像素完全一致：
        # 复用上一档的文件，不再落一份字节相同的副本
        if prev_files is not None and resized.size == prev_size:
            entry["sizes"][size_name] = {
                **prev_files,
                "w": resized.width,
                "h": resized.height,
            }
            continue

        size_dir = output_dir / size_name
        size_dir.mkdir(parents=True, exist_ok=True)

        # WebP：始终生成（格式转换，必须编码）
        webp_path = size_dir / f"{base_name}.webp"
        resized.save(webp_path, "WEBP", quality=WEBP_QUALITY, method=6)

        # JPG：不需要缩放且不需要编码时，直接复制原图（零损失）
        jpg_path = size_dir / f"{base_name}.jpg"
        if not needs_resize and not need_encode:
            shutil.copy2(input_path, jpg_path)
            jpg_kb = input_path.stat().st_size / 1024
            out_quality = src_quality
        else:
            # 自适应质量：先以原图 quality 保存，过大才降质
            out_quality, jpg_kb = save_jpg_adaptive(
                resized, jpg_path, spec["max_kb"], src_quality=src_quality
            )

        prev_size = resized.size
        prev_files = {
            "webp": f"{size_name}/{base_name}.webp",
            "jpg": f"{size_name}/{base_name}.jpg",
        }
        entry["sizes"][size_name] = {
            **prev_files,
            "w": resized.width,
            "h": resized.height,
        }

    quality_info = f"q={src_quality}" if src_quality else "q=N/A"
    print(f"  [完成] {input_path.name} → {base_name} "
          f"({img.size[0]}x{img.size[1]}, 原图{quality_info})")
    return entry


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
    manifest = load_existing_manifest(output_dir)

    # 收集原图
    files = sorted([
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in INPUT_EXTS
    ])

    # .heic 列在支持格式里，但需要 pillow-heif 才能打开；没装就明确跳过，
    # 免得它们走到 process_file 里抛一个「无法打开」的模糊错误
    if not HEIC_SUPPORTED:
        heic = [f for f in files if f.suffix.lower() == ".heic"]
        if heic:
            print(f"  [注意] 跳过 {len(heic)} 个 .heic，需要先 pip install pillow-heif")
            files = [f for f in files if f.suffix.lower() != ".heic"]

    # 原图目录为空时直接退出。这可能真是删光了，也可能是目录指错/没挂上，
    # 两种都不该走下面的对齐逻辑 —— 那会把整份清单连同派生产物一起清空。
    if not files:
        print(f"未在 {input_dir} 中找到支持的图片文件")
        sys.exit(1)

    # 原图目录是清单的真相源：每张原图的 MD5 就是它的条目 id（与 process_file
    # 的 base_name 同源）。这里先算一遍，既给下面的对齐用，也给 MD5 去重用，
    # 不让同一批文件被读两遍。
    source_hashes = {f: file_hash(f) for f in files}
    source_ids = set(source_hashes.values())

    # ── 对齐清单 ──────────────────────────────────────
    # 原图已经不在了 → 这张图是被移除的，记录和它的派生文件都该消失。
    # 派生文件丢了但原图还在 → 只摘记录，主流程会当新图重新加工补齐。
    kept, removed = [], []
    for item in manifest:
        if item.get("id") not in source_ids:
            removed.append(item)
        elif not all((output_dir / rel).exists() for rel in entry_files(item)):
            continue
        else:
            kept.append(item)

    if removed:
        # 只删「没有任何保留条目引用」的文件：万一两条记录指向同一路径，
        # 删掉会让还在用的那一条变成断链
        kept_files = set()
        for item in kept:
            kept_files |= entry_files(item)

        gone = set()
        for item in removed:
            for rel in entry_files(item):
                if rel in kept_files or rel in gone:
                    continue
                target = output_dir / rel
                if target.exists():
                    target.unlink()
                    gone.add(rel)

        print(f"{len(removed)} 张原图已不在 {input_dir}，"
              f"移除其记录与 {len(gone)} 个派生文件: {', '.join(i['id'] for i in removed)}")

    manifest = kept
    existing_ids = {item["id"] for item in manifest}

    print(f"已有图片: {len(manifest)} 张" if manifest else "首次加工")

    # 筛选新图（MD5 去重，哈希上面已经算好）
    new_files = []
    skipped = 0
    for f in files:
        fid = source_hashes[f]
        if fid in existing_ids:
            skipped += 1
        else:
            new_files.append((f, fid))

    if skipped:
        print(f"跳过 {skipped} 张已加工的图片")

    manifest_path = output_dir / "manifest.json"
    manifest_js_path = output_dir / "manifest.js"

    def write_manifest_js():
        """产出页面直接可用的清单脚本

        file:// 下浏览器会拦截 fetch(manifest.json)，页面改读这份外链脚本
        （script 不受同源拦截）。它与 manifest.json 由同一次运行写出，
        因此页面数据不可能落后于清单。
        """
        payload = json.dumps(manifest, ensure_ascii=False, indent=2)
        with open(manifest_js_path, "w", encoding="utf-8") as fp:
            fp.write("// 由 bin/process_images.py 生成，请勿手工编辑。\n")
            fp.write("// 页面在 file:// 下无法 fetch 同目录的 manifest.json，改读这份。\n")
            fp.write(f"self.__BG_MANIFEST__ = {payload};\n")

    def flush():
        """落盘清单：孤立清理与新图加工都走这里，顺序不依赖调用点"""
        with open(manifest_path, "w", encoding="utf-8") as fp:
            json.dump(manifest, fp, ensure_ascii=False, indent=2)
            # 文本文件以换行结尾，否则每次重跑都会产生一个纯格式的 diff
            fp.write("\n")
        write_manifest_js()

    if not new_files:
        # 没有新图也要落盘：孤立记录可能已被清理
        flush()
        print("没有新图片需要加工")
        return

    print(f"新增 {len(new_files)} 张图片，开始加工...\n")

    for i, (f, fid) in enumerate(new_files, 1):
        print(f"[{i}/{len(new_files)}] {f.name}")
        entry = process_file(f, output_dir, base_name=fid)
        if entry:
            manifest.append(entry)

    # 写入清单（此时 manifest 已含新图，兜底图同步到最新）
    flush()

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
    print(f"页面数据: {manifest_js_path}")


if __name__ == "__main__":
    main()

# TYBlog

个人主页 - 日常生活记录

## 功能

- 响应式设计，适配桌面、平板、手机
- 背景图自动切换，支持 WebP/JPG 自适应
- 图片处理脚本，支持增量加工、自适应质量

## 项目结构

```
index.html          # 主页面
css/style.css       # 主题样式
js/action.js        # 背景图切换逻辑
scripts/process_images.py  # 图片加工脚本
source/             # 原始图片
img/                # 加工后图片
```

## 使用

1. 直接打开 `index.html` 即可访问
2. 图片处理：`python3 scripts/process_images.py source img`

## 技术栈

- HTML5 / CSS3 / JavaScript
- Python (Pillow) 用于图片处理
---
title: 照片整理脚本
description: 按拍摄日期自动把照片分文件夹，顺便重命名。
pubDate: 2026-02-18
tags: ['Python', '自动化']
status: 已归档
featured: false
---

## 解决的问题

手机导出的照片全堆在一个文件夹里，几千张，文件名是 `IMG_1234.jpg` 这种。想找某次旅行的照片基本靠翻。

## 做了什么

读照片 EXIF 里的拍摄时间，然后：

```text
2026-02-18_巴黎/
├── 20260218_091233.jpg
├── 20260218_104455.jpg
└── 20260218_183012.jpg
```

## 核心代码

```python
from PIL import Image
from PIL.ExifTags import TAGS
from pathlib import Path

def shot_time(path):
    img = Image.open(path)
    exif = img.getexif()
    for tag_id, value in exif.items():
        if TAGS.get(tag_id) == "DateTimeOriginal":
            return value
    return None
```

## 后来为什么归档了

系统自带的照片 App 已经能做这件事了。**工具的价值会随时间消失**，这很正常。

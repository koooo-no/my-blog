---
title: CSS 布局：Flex 还是 Grid？
description: 一句话判断该用哪个，附常见场景对照。
pubDate: 2026-07-08
category: 前端
tags: ['CSS', '布局']
order: 1
---

## 一句话判断

- **一维排列**（一行或一列）→ **Flex**
- **二维排列**（行列都要控制）→ **Grid**

## Flex 典型场景

导航栏、按钮组、卡片内部元素对齐：

```css
.nav {
  display: flex;
  align-items: center;
  gap: 12px;
}
```

## Grid 典型场景

整页布局、卡片网格：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
```

上面这行 CSS 会**自动**根据容器宽度决定放几列，不用写媒体查询。

## 常见误区

> Grid 不是 Flex 的升级版，它们是解决不同问题的工具。

需要元素之间相互推挤、按内容伸缩 → Flex。
需要严格对齐到网格 → Grid。

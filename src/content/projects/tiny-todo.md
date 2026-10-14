---
title: 极简待办
description: 一个只有三件事的待办清单，为了治好我的清单焦虑。
pubDate: 2026-04-02
tags: ['小工具', 'React']
status: 已完成
featured: false
---

## 设计思路

大部分待办应用的问题是：**可以无限加任务**。结果是清单越来越长，人越来越焦虑。

这个应用只允许三件事：

1. 今天必须做的
2. 今天想做的
3. 今天不做也行的

加第四件？先删掉一件。

## 实现

用 React 写的纯前端应用，数据存在浏览器本地。

```js
const [tasks, setTasks] = useState(() => {
  const saved = localStorage.getItem('tasks');
  return saved ? JSON.parse(saved) : [];
});
```

## 结果

我用了一个月，确实管用。不是因为功能强，而是因为**它逼我做选择**。

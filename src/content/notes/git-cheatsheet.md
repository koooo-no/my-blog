---
title: Git 常用命令速查
description: 日常最常用的 Git 命令，忘了就回来翻。
pubDate: 2026-08-15
updatedDate: 2026-10-01
category: 开发工具
tags: ['Git', '速查']
order: 1
---

## 基础流程

```bash
git status              # 看当前有哪些改动
git add .               # 把所有改动加入暂存区
git commit -m "说明"    # 提交
git push                # 推到远程仓库
```

## 撤销操作

| 场景 | 命令 |
| --- | --- |
| 撤销工作区某个文件的修改 | `git restore 文件名` |
| 撤销暂存 | `git restore --staged 文件名` |
| 修改最后一次提交信息 | `git commit --amend` |
| 回退到某个提交（保留改动） | `git reset --soft <commit>` |
| 回退到某个提交（丢弃改动） | `git reset --hard <commit>` |

> ⚠️ `--hard` 会**永久丢弃**未提交的改动，用之前先确认。

## 分支

```bash
git switch -c 新分支名     # 新建并切换
git switch main            # 切回主分支
git branch -d 分支名       # 删除已合并的分支
```

## 看历史

```bash
git log --oneline --graph --all   # 图形化看所有分支
git diff HEAD~1                   # 和上一个提交比较
```

# Code Search

本地代码关键词检索工具，快速在 workspace 项目文件中搜索代码内容，支持高亮显示匹配行。

## 快速启动

```bash
./start.sh
```

浏览器自动打开 [http://localhost:3456](http://localhost:3456)，按 `Ctrl+C` 停止服务。

## 功能特性

| 功能 | 说明 |
|------|------|
| 内容搜索 | 逐行扫描文件内容，展示匹配行号与代码片段，关键词高亮 |
| 文件名搜索 | 按文件名进行模糊匹配 |
| 区分大小写 | 可选开关，默认不区分 |
| 正则表达式 | 支持正则模式搜索 |
| 自定义目录 | 页面中可随时修改搜索目录 |

## 排除规则

以下内容自动跳过，不参与搜索：

- **目录**：`node_modules` `.git` `dist` `build` `.next` `.nuxt` `vendor` `target` `.cache` `coverage` 等
- **文件**：`*.lock` `*.min.js` `*.map` `*.log` 以及图片、音视频、二进制文件等

## 项目结构

```
search-pj/
├── server.js       # 后端 API（Express + 文件系统遍历）
├── start.sh        # 一键启动脚本
├── package.json
└── public/
    └── index.html  # 前端页面
```

## 手动启动

```bash
# 首次运行需安装依赖
npm install

# 启动服务
node server.js
```

## 默认搜索路径

服务启动后默认搜索 `workspacedb/workspace` 目录，可在页面「搜索目录」输入框中修改为任意路径，点击「重置」恢复默认。

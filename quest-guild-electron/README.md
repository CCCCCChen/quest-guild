# 悬赏任务公会 - Electron 桌面版

RPG 风格的目标管理工具（Quest Guild），Electron 桌面壳 + React 前端。

> **重要**：本目录只是桌面壳（主进程/预加载/渲染产物/图标）。**依赖、npm 脚本、electron-builder 配置全部在仓库根 `package.json`**，本目录没有 package.json。所有命令在**仓库根目录**执行。

## 🚀 命令（仓库根目录）

| 命令 | 说明 |
|------|------|
| `npm run electron:dev` | 开发运行（加载 `renderer/app` 构建产物） |
| `npm run electron:build:win64` | 打包 nsis 安装包 + 便携版（x64） |
| `npm run electron:build:portable` | 仅打包便携单文件 |
| `npm run electron:release` | 一键发版：patch 升版（git commit + tag）+ 打包 win64 |

打包产物在 `quest-guild-electron/out/`：

```
out/
├── 悬赏任务公会 Setup <版本>.exe      # NSIS 安装包（可选目录、桌面/开始菜单快捷方式）
├── 悬赏任务公会 Setup <版本>.exe.blockmap
├── 悬赏任务公会-Portable.exe          # 便携单文件
├── latest.yml                        # 更新描述（未来 electron-updater 用）
└── win-unpacked/                     # 绿色解包版（悬赏任务公会.exe）
```

## 🔖 版本号

发版前用 `npm run version:patch|minor|major` 升版本号（自动改 package.json + commit `chore: release vX.Y.Z` + 打 git tag `vX.Y.Z`），然后 `npm run electron:build:win64`。预览：`node scripts/bump-version.mjs patch --dry`。

## 📁 目录结构

```
quest-guild-electron/
├── main.cjs              # Electron 主进程（CommonJS，根 type:module 下必须 .cjs）
├── preload.cjs           # 预加载脚本（API 桥接）
├── renderer/             # 渲染进程构建产物（scripts/build-renderer.mjs 输出，不入库）
│   └── app/              #   vite build 产物
├── assets/               # 应用图标 icon.ico / icon.png（scripts/gen-electron-icon.py 生成）
├── out/                  # electron-builder 打包输出（不入库）
├── .electron-cache/      # Electron 二进制缓存（build.electronDownload.cache）
└── .electron-cache-fresh/# NSIS 工具缓存（ELECTRON_BUILDER_CACHE，已补齐 nsis-3.0.4.1 + nsis-resources-3.4.1）
```

## ⚙️ 配置

- 全部在根 `package.json` 的 `build` 字段：`productName`（悬赏任务公会）、`directories.output`（out/）、`win.target`（nsis + portable）、`nsis`（可选安装目录等）。
- 主进程 `main.cjs` 不依赖本地 server（前端数据存 localStorage + 云端同步，见根 README）。

## 🆘 常见问题

**Q: 打包报 `Plugin not found, cannot call UAC::_`？**
A: NSIS 工具缓存不完整（缺 nsis-resources）。用 `fs.cpSync` 把 electron-builder 下载解压后的临时数字目录复制为 `.electron-cache-fresh/nsis/nsis-resources-3.4.1`（含 UAC.dll）。

**Q: NSIS 缓存目录删不掉/重命名报 Permission denied？**
A: 本机环境禁止 rename。不要尝试删除，改用复制新目录 + 切换 `ELECTRON_BUILDER_CACHE` 指向。

**Q: 打包后运行白屏？**
A: 确认 `renderer/app/` 存在（`npm run electron:build:renderer`），主进程加载的是本地构建产物而非在线地址。

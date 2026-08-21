# 项目技术规范

## 技术栈

- 前端: React 19 + TypeScript
- 样式: Tailwind CSS v4
- UI 组件: shadcn/ui `import { Button } from "@/components/ui/button";`
- 图标: lucide-react `import { SearchIcon } from "lucide-react";`
- 图表: echarts-for-react `import ReactECharts from "echarts-for-react";`
- 动画: framer-motion `import { motion } from "framer-motion";`
- 路由: react-router-dom `import { Link, useNavigate } from "react-router-dom";`

---

## 目录结构

```
src/
├── index.tsx            # 入口（勿修改）
├── app.tsx              # 路由配置（仅在 <Routes> 内增删 <Route>）
├── index.css            # 全局样式 + 主题变量
├── components/          # 基础 UI 组件（禁止存放业务组件）
│   ├── layout.tsx       # 全局布局容器（含 <Outlet />）
│   └── ui/              # shadcn/ui 内置组件（勿修改）
├── pages/               # 页面模块（每个页面一个目录）
│   ├── <PageName>/      # 页面目录示例
│   │   ├── PageName.tsx        # 页面入口文件与目录同名
│   │   └── components/         # 页面专属组件
│   └── NotFoundPage/
│       └── NotFoundPage.tsx
├── hooks/               # 自定义 Hooks
└── lib/                 # 工具函数（cn() 等）

shared/
└── static/              # 静态资源
    ├── data/            # 数据文件（JSON）
    └── images/          # 图片资源
```

---

## 模板初始状态

- `app.tsx` 首页路由指向平台内置的 `<Welcome />` 组件
- 开发时需将 `index` 路由替换为业务首页，并在 `pages/` 下创建对应页面目录
- `layout.tsx` 为空壳容器（仅 `<Outlet />`），需根据需求实现导航和布局

---

## 禁止修改的文件

| 文件 | 原因 |
|------|------|
| `src/index.tsx` | Provider 层级 + 样式引入，由模板管理 |
| `src/components/ui/*` | shadcn/ui 内置组件，版本锁定 |

---

## 文件放置规则

| 内容类型 | 放置位置 |
|---------|---------|
| 新页面 | `src/pages/<PageName>/PageName.tsx` |
| 页面专属组件 | `src/pages/<PageName>/components/` |
| 自定义 Hooks | `src/hooks/` |
| 工具函数 | `src/lib/` |
| 静态数据文件 | `shared/static/data/` |
| 静态图片 | `shared/static/images/` |

---

## 导入路径

```typescript
// @/ 别名 → src/
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// @shared/ 别名 → shared/
import heroImage from "@shared/static/images/hero.png";
import configData from "@shared/static/config.json";
```

---

## 路由配置

- 新增页面需在 `src/app.tsx` 的 `<Routes>` 内注册 `<Route>`
- `BrowserRouter` 已在 `index.tsx` 中配置，`app.tsx` 中**禁止**再包裹 Router

---

## 主题变量

主题色定义在 `src/index.css`，通过 `:root` CSS 变量 + `@theme inline` 注册到 Tailwind。

| 用途 | Tailwind 类 | CSS 变量 |
|------|------------|----------|
| 页面背景 | `bg-background` | `--background` |
| 主文本 | `text-foreground` | `--foreground` |
| 卡片背景 | `bg-card` | `--card` |
| 次要文本 | `text-muted-foreground` | `--muted-foreground` |
| 主色 | `bg-primary` / `text-primary` | `--primary` |
| 强调色 | `bg-accent` | `--accent` |
| 边框 | `border-border` | `--border` |
| 危险色 | `text-destructive` | `--destructive` |
| 图表色 | `bg-chart-1` ~ `bg-chart-5` | `--chart-1` ~ `--chart-5` |

HSL 格式使用**空格分隔**：`--primary: hsl(150 60% 40%);`

---

## Electron 桌面端（打包 / 发版）

桌面壳为 `quest-guild-electron/`（`main.cjs` + `preload.cjs` + `renderer/` 构建产物 + `assets/` 图标），
但**依赖、脚本、electron-builder 配置全部在根 `package.json`**（单一事实源，无子目录 package.json）。

### 常用命令（根目录执行）

| 命令 | 说明 |
|------|------|
| `npm run electron:dev` | 开发运行（加载本地构建产物） |
| `npm run electron:build:win64` | 打包 nsis 安装包 + 便携版（x64） |
| `npm run electron:build:portable` | 仅打包便携单文件 |
| `npm run version:patch` / `version:minor` / `version:major` | 升版本号 + git commit + 打 tag `vX.Y.Z` |
| `npm run electron:release` | **一键发版** = patch 升版 + 打包 win64 |

### 发版流程（方案 1：npm version + git tag）

1. 代码改动完成后先提交
2. 按改动规模升版：`npm run version:patch`（修 bug）/ `version:minor`（新功能）/ `version:major`（大版本）
   —— 自动改 `package.json`/`package-lock.json`、commit `chore: release vX.Y.Z`、打 tag
3. 打包：`npm run electron:build:win64`
4. 产物在 `quest-guild-electron/out/`：`悬赏任务公会 Setup <版本>.exe` + `悬赏任务公会-Portable.exe` + `win-unpacked/` 绿色版

也可以跳过第 2 步单独执行 `npm run electron:release`（默认 patch）。
预览变更结果而不落盘：`node scripts/bump-version.mjs patch --dry`

### 打包注意事项（本机踩坑记录）

- **缓存目录**：`ELECTRON_BUILDER_CACHE` 指向 `quest-guild-electron/.electron-cache-fresh`（nsis 工具缓存，
  `scripts/electron-retry-build.mjs` 已固化）；Electron 二进制仍在 `.electron-cache`（`build.electronDownload.cache`）。
- **环境禁止 rename**：NSIS 工具缓存若破损，删除/重命名会被拒。修复方法：用 `fs.cpSync` 把 electron-builder
  下载解压后的临时数字目录**复制**为 `nsis-3.0.4.1` / `nsis-resources-3.4.1`（后者含 UAC.dll，缺失报
  `Plugin not found, cannot call UAC::_`）。
- **产物名**：中间 nsis 7z 用 `package.json` 的 `name`（miaoda-vite-react-app），最终 exe 用 `productName`（悬赏任务公会），属正常现象。
- **图标**：`quest-guild-electron/assets/icon.ico`（可用 `scripts/gen-electron-icon.py` 重新生成）。

详见 `quest-guild-electron/README.md`。

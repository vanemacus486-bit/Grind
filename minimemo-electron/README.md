# 极简背词 — 本地桌面版

Electron + React + TypeScript + Mantine + Dexie

## 目录结构

```
minimemo-electron/
├── src/
│   ├── main/              # Electron 主进程
│   │   └── index.ts
│   ├── preload/           # 预加载脚本
│   │   └── index.ts
│   └── renderer/          # React 前端
│       └── src/
│           ├── App.tsx
│           ├── main.tsx
│           ├── components/   # 6 个主视图组件
│           ├── db/           # Dexie 数据层 (types + dexie.ts)
│           └── utils/        # 导入解析工具
├── out/                   # 构建产物
├── release/
│   └── win-unpacked/      # 打包后的桌面应用
│       └── 极简背词.exe   # ← 双击即可运行
├── package.json
└── electron.vite.config.ts
```

## 使用方式

### 方式一：双击桌面图标（推荐）
桌面 「**极简背词**」快捷方式直接启动打包版应用。

### 方式二：开发模式（热更新）
```bash
cd D:\Dev\Grind\minimemo-electron
npm run dev
```
Electron 窗口打开后，改代码自动热更新。

### 方式三：重新打包
```bash
cd D:\Dev\Grind\minimemo-electron
npm run package
```
产物在 `release/win-unpacked/` 目录。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面壳 | Electron 34 |
| 构建 | electron-vite + Vite 6 |
| 前端 | React 19 + TypeScript |
| UI | Mantine 7 (Paper, Group, Stack, Button, Card, etc.) |
| 存储 | Dexie (IndexedDB) |
| 通知 | @mantine/notifications |
| 深色模式 | Mantine localStorageColorSchemeManager |

## 功能清单

- ✅ 导入：粘贴文本 / 文件上传 (txt/csv)，自动识别分隔符
- ✅ 背诵：点击卡片划掉 + 滑出动画
- ✅ 重组：表数减少自动合并 / 手动按钮
- ✅ 检验：翻卡自评，通过→mastered，失败→退回 active
- ✅ 统计：连续天数、热力图、24h 时段直方图、累计数字（全正向）
- ✅ 设置：每表词数(5–50)、重组模式、检验方向、深色模式
- ✅ 备份：JSON 导出 / 导入

## 设计原则（已贯彻）

- 打开即背，无菜单/待复习数字
- 无欠债感：无逾期、无落后、无惩罚性统计
- 只给正反馈：数字全正向，不催不羞辱
- 所有数据存本地，无需网络

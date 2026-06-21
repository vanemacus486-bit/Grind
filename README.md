# ✏️ Grind

> 把背单词刷成「划待办」一样轻。

Grind 是一个**分级英语词库**背诵工具，核心交互简单到极致——**看一眼、认识就划掉**，划完的词进入**检验模式**回忆，记住的归档、没记住的回炉。内置从高考到雅思的**累进式词库（8358 词，按词频从易到难）**，全部数据存在本地，开箱即用、无需登录、无需联网。

本仓库是一个 monorepo，包含两套实现：

| 目录 | 形态 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| [`minimemo-electron/`](minimemo-electron) | 🖥️ 桌面应用「Grind」 | Electron + Mantine | 主力版本，可打包成 Windows 安装包 |
| [`minimemo/`](minimemo) | 🌐 网页版「极简背词」 | Vite + 原生 CSS | 轻量纯前端版本 |
| [`scripts/`](scripts) | 🛠️ 词库构建脚本 | Node | 从 ECDICT 生成 / 清洗内置词库 |

---

## ✨ 特性

- **划词背诵** —— 单词以「待办清单」形式成表呈现，点一下即划掉，自动重组剩余词。
- **累进分级词库** —— 选「雅思」= 背高考∪四级∪六级∪雅思的全部词；选「高考」只背基础。越往上越全。
- **检验模式** —— 划掉的词做翻卡回忆（词→义 / 义→词可切换），认识归档、不认识回到待背。
- **单词发音** 🔊 —— 浏览器原生 TTS，离线可用，背诵卡 / 检验卡 / 词库列表均可朗读。
- **词库浏览与筛选** —— 搜索单词或释义，按背诵状态 / 柯林斯星级 / 牛津核心词筛选；自建词库可改名、删除。
- **学习统计** —— 连续天数、活跃热力图、时段习惯直方图、掌握进度。
- **导入自定义词库** —— 粘贴或上传 `词 释义` 文本，一键建库开背。
- **深色模式 + 本地存储** —— 数据全部存于本地 IndexedDB，支持 JSON 备份导出 / 导入。

---

## 📚 内置词库

词库由 [ECDICT](https://github.com/skywind3000/ECDICT) 提取并清洗而来，剔除了专有名词、缩写、词组等噪音，仅保留可背诵的纯词条，共 **8358 词**。

采用**累进式**分级——选中某一等级即背「该等级及以下的全部词」：

| 选中词库 | 实际背诵词数 |
| --- | ---: |
| 📚 高考 | 3582 |
| 📚 四级 | 5220 |
| 📚 六级 | 6967 |
| 📚 **雅思** | **8358** |

> 每个词带音标、中英文释义、词频（柯林斯星级 / 牛津核心 / BNC-COCA 频次）与词形变化。

---

## 🚀 快速开始

### 桌面版（Grind / Electron）

```bash
cd minimemo-electron
npm install
npm run dev          # 启动开发模式（热重载）
```

打包 Windows 应用：

```bash
npm run build                  # 编译 main / preload / renderer 到 out/
npx electron-builder --win nsis
# 产物：
#   release/Grind Setup 1.0.0.exe   ← NSIS 安装包
#   release/win-unpacked/Grind.exe  ← 免安装直接运行版
```

### 网页版（minimemo / Vite）

```bash
cd minimemo
npm install
npm run dev          # 本地开发服务器
npm run build        # tsc 类型检查 + vite 生产构建到 dist/
npm run preview      # 预览构建产物
```

---

## 🛠️ 重新构建词库

内置词库已随仓库提供（`*/public/builtin-vocab.json`），一般无需重建。若要从源头重新生成：

```bash
# 1. 从 ECDICT 提取分级词库（自动下载，或用 --input 指定本地 ecdict.csv）
node scripts/build-seed.mjs

# 2. 清洗（剔除专有名词等噪音）并同步到两个 app 的 public 目录
node scripts/clean-seed.mjs
```

清洗规则（[`scripts/build-seed.mjs`](scripts/build-seed.mjs) 中的 `isStudyable`，为唯一真源）：必须有中文释义、≥2 字符、首字母非大写、仅含字母与连字符。

> 改动 seed 数据后，记得把 `src/db/types.ts` 里的 `BUILTIN_VOCAB_VERSION` +1——客户端会据此自动增量更新并清洗旧库，同时保留用户的背诵进度。

---

## 🧱 技术栈

- **核心**：React 19 · TypeScript · [Dexie](https://dexie.org/)（IndexedDB）· React Router 7
- **桌面版**：Electron 34 · electron-vite · [Mantine](https://mantine.dev/) 7 · electron-builder
- **网页版**：Vite 8 · 原生 CSS（CSS 变量 + 深色模式）
- **发音**：Web Speech API（`speechSynthesis`，离线）

### 数据模型（简）

```
Deck（词库）──< Word（单词：状态 active/struck/mastered + 词频/星级/词形）
AppEvent（背诵事件，用于统计）   AppSettings（每表词数 / 重组模式 / 检验方向 / 主题 / 起点词库）
```

---

## 🙏 致谢

- 词库数据来自 [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)（MIT）。

## 📄 License

[MIT](LICENSE) © 2026 vanemacus486-bit

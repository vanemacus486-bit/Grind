# Grind — 打包与重打 exe 运行手册（给 AI / 协作者）

> 这是一份**可照抄执行**的操作手册：如何把 Grind 编译成 Windows 桌面程序、放到桌面、以及之后如何重打更新。
> 桌面应用源码在 **`minimemo-electron/`** 子目录，**所有命令都在该目录下执行**（不是仓库根 `D:\Dev\Grind`）。

## 0. 项目速览
- Grind = Electron + React 19 + Mantine v7 的 Windows 桌面背词应用，源码在 `minimemo-electron/`。
- 应用名 `Grind`，appId `com.grind.app`，版本取自 `minimemo-electron/package.json` 的 `version`（当前 `1.0.0`）。
- 构建产物（都在 `minimemo-electron/` 下）：
  - `out/` — electron-vite 编译的 main/preload/renderer（中间产物）。
  - `release/win-unpacked/Grind.exe` — **免安装**独立程序（自带 Electron 运行时，约 182 MB）。
  - `release/Grind Setup <version>.exe` — NSIS **安装包**（可选，见第 4 节）。
- 打包配置见 `minimemo-electron/package.json` 的 `build` 字段（输出目录 `release/`，Win 默认目标 `nsis`）。

---

## 1. 重打 exe（免安装版）— 最常用
> ⚠️ 打包前**先关掉正在运行的 Grind**，否则 exe 被占用，覆盖会报 EBUSY/文件占用。
> 前提：已在 `minimemo-electron/` 跑过 `npm install`；用户全局 `~/.npmrc` 里的 electron 镜像保留（首次会经镜像下载构建二进制，打包日志里的 `electron_mirror` warning 是正常的）。

PowerShell 依次执行（路径按实际仓库位置调整）：

```powershell
Set-Location 'D:\Dev\Grind\minimemo-electron'

# (1) 关掉在跑的 Grind，释放 exe 占用
Get-Process Grind -ErrorAction SilentlyContinue | Stop-Process -Force

# (2) 编译 main / preload / renderer  —— 同时验证当前代码能否构建（报错则先修代码）
npx electron-vite build

# (3) 打包成免安装独立程序 -> release\win-unpacked\Grind.exe
npx electron-builder --win dir
```

产物固定在：`minimemo-electron\release\win-unpacked\Grind.exe`。
**重打会覆盖同一个 exe 路径**，所以桌面快捷方式（第 2 节）无需重建即自动指向新版本。

---

## 2. 创建 / 重建桌面快捷方式
> 只有第一次、或快捷方式被删了才需要跑这节；日常重打不用。

```powershell
$exe = 'D:\Dev\Grind\minimemo-electron\release\win-unpacked\Grind.exe'
if (-not (Test-Path $exe)) { throw '未找到 Grind.exe，请先执行第 1 节打包' }

$desktop = [Environment]::GetFolderPath('Desktop')   # 自动处理 OneDrive 重定向桌面
$lnk = Join-Path $desktop 'Grind.lnk'
$ws  = New-Object -ComObject WScript.Shell
$sc  = $ws.CreateShortcut($lnk)
$sc.TargetPath       = $exe
$sc.WorkingDirectory = (Split-Path $exe)
$sc.IconLocation     = "$exe,0"
$sc.Description       = 'Grind — 把背词刷成划待办'
$sc.Save()
if (Test-Path $lnk) { "OK 快捷方式: $lnk" } else { throw '快捷方式创建失败' }
```

---

## 3. 验证（每次重打后必须做）
```powershell
$exe = 'D:\Dev\Grind\minimemo-electron\release\win-unpacked\Grind.exe'
Start-Process $exe
Start-Sleep -Seconds 4
if (Get-Process Grind -ErrorAction SilentlyContinue) { 'OK: 启动正常' } else { 'FAIL: 启动即退出，见第 6 节排错' }
```
正常会有 ~4 个 Grind 进程（Electron 多进程）。白屏/秒退见第 6 节。

---

## 4. 可选：生成正规安装包（NSIS）—— 推荐分发用
比免安装版更干净：安装到 Program Files、自动建桌面快捷方式 + 开始菜单 + 卸载程序，**彻底脱离开发目录**。

```powershell
Set-Location 'D:\Dev\Grind\minimemo-electron'
Get-Process Grind -ErrorAction SilentlyContinue | Stop-Process -Force
npx electron-vite build
npx electron-builder --win nsis
```
产物：`minimemo-electron\release\Grind Setup 1.0.0.exe`（版本号取自 package.json）。双击安装即可，安装器会**自动建桌面快捷方式**（`package.json` 里 `nsis.createDesktopShortcut: true`），这种模式**不需要**第 2 节手动建快捷方式。

---

## 5. 重要约束 / 坑（务必遵守）
- **别删 `release\win-unpacked\` 文件夹**：免安装版快捷方式指向它，删了/移动了图标就失效。要彻底独立请用第 4 节安装包。
- **重打前先关 Grind**：exe 运行时被系统锁定，不关会覆盖失败。
- **打包的是当前工作区代码**：打包前确认要进的修复都已落地、`npx electron-vite build` 不报错。（注意：深色模式相关改动若尚未应用并验证，打出来的桌面版同样会带着该问题。）
- **图标是默认 Electron 图标**：`build/` 目录目前为空。要换成 Grind 自己的图标，把一张 `icon.ico`（≥256×256）放到 `minimemo-electron\build\icon.ico`，electron-builder 会自动采用，然后重打。
- **镜像别删**：`~/.npmrc` 里的 `electron_mirror` / `electron_builder_binaries_mirror` 用于首次下载 Electron 与 electron-builder 二进制。
- **执行目录**：所有命令在 `minimemo-electron/` 下，不是仓库根。

---

## 6. 排错
- **electron-builder 卡在下载**：在拉构建二进制；确认 `~/.npmrc` 镜像在、网络通，重试即可。
- **覆盖失败 / EBUSY / “文件正由另一进程使用”**：Grind 还在跑 → `Get-Process Grind | Stop-Process -Force` 后重打。
- **打开白屏**：检查 `out\renderer\index.html` 及 `out\renderer\assets\*` 是否生成；重跑 `npx electron-vite build`。主进程通过 `loadFile('../renderer/index.html')` 加载（路径相对 `out/main`）。
- **快捷方式点了没反应**：多半是 `release\win-unpacked\` 被删/移动 → 重打（第 1 节）+ 重建快捷方式（第 2 节）。
- **`npx electron-builder` 找不到命令**：先 `npm install`（确保 devDependencies 里的 electron-builder 已装）。

# 投标慧眼

投标慧眼是一款默认离线运行的桌面投标文件属性与异常关联检测工具。它可以批量检查不同供应商提交的 ZIP，也可以直接检查单个 Office、PDF、图片或文本文件。

检测结果用于提供人工复核线索，不直接作出串标、违法或其他法律定性结论。

## 主要功能

- 白色为主的浅色专业界面，检测结果、风险证据和文件属性直接在页面内展开，不使用层层嵌套的弹窗。
- ZIP 文件名或符合条件的一级目录名可作为供应商名称。
- 支持 DOCX、DOCM、XLSX、XLSM、PPTX、PPTM、PDF、常见图片和文本文件。
- 展示 Office 作者、最后保存者、修订号、版本号、程序名称、公司、管理者、创建时间、最后保存时间和总编辑时间等属性；缺失字段明确显示“未提取到”。
- PDF“说明”属性同时展示传统 Info Dictionary 和 XMP Metadata Stream，包括作者、标题、主题、关键词、创建程序、制作工具、创建时间、修改时间、陷印状态和元数据时间。
- PDF Info 与 XMP 默认联动修改；也可以解除单项关联，分别编辑两套值，并提示不同阅读器可能显示不同结果。
- 支持直接修改、标记删除、全选属性，并可选择“保存”覆盖当前文件或“另存为”生成副本；写入完成后会重新读取文件验证结果，并可继续编辑。
- 默认只启用文件属性检查；完全相同文件、文本 SimHash 相似度、相同图片与媒体指纹默认不启用。
- 支持人工复核状态、项目 JSON 保存、历史项目打开，以及 PDF、Excel、HTML、JSON 报告导出。
- 文件真实签名识别、SHA-256、ZIP 路径穿越与解压限制；宏和 PDF JavaScript 只识别、不执行。

## Windows 运行

开发环境建议使用 Node.js 20 或更高版本。在项目目录执行：

```powershell
cd E:\github\volnet\tender-guard
npm.cmd install
npm.cmd start
```

如果 Electron 下载不完整并提示 `Electron failed to install correctly`，可以删除 Electron 依赖后重新安装：

```powershell
Remove-Item -Recurse -Force .\node_modules\electron
npm.cmd install
npm.cmd start
```

最终用户无需安装 Node.js，直接运行构建产物：

```text
dist\投标慧眼-1.1.0-安装程序.exe
```

## 命令行检测

```powershell
node src\cli.js tests\甲.zip tests\乙.zip --out tests-output
```

## 测试与构建

```powershell
npm.cmd test
npm.cmd run dist:win
```

macOS 安装包需要在 macOS 构建机上生成：

```bash
npm run dist:mac
```

正式对外分发 Windows 或 macOS 安装包时，应配置对应的平台代码签名。

## PDF 元数据处理

修改 PDF 属性时，程序会同时处理两套常见元数据：

1. 传统 PDF Info Dictionary，例如 `/Author`、`/Title`、`/Creator` 和 `/Producer`。
2. XMP Metadata Stream，例如 `dc:creator`、`dc:title`、`xmp:CreatorTool` 和 `pdf:Producer`。

默认联动状态下，修改 Info 会同步写入 XMP，确保 Edge、WPS 和 Adobe Acrobat 等读取策略不同的软件尽量显示一致的属性。解除联动后，可以分别维护 Info 与 XMP；此时不同阅读器可能显示不同结果。

## 安全与数据

- 软件不包含遥测、联网 API 或在线 AI，分析过程在本机完成。
- 只有用户明确点击“保存”时才覆盖当前文件；“另存为”不会修改原文件。
- 写入时使用临时文件和备份替换流程，完成后重新读取验证元数据。
- 真实投标文件、解压内容、检测数据库和报告不应提交到仓库，相关路径已加入 `.gitignore`。
- 加密 Office/PDF 文件只报告状态，不尝试绕过密码或权限限制。

## 已知限制

- 旧式二进制 DOC、XLS、PPT 仅识别文件类型，不进行深层属性解析。
- PDF 文本提取和扫描件判断采用本地结构分析，不包含 OCR。
- HEIC 感知哈希、VBA 源码反编译和数字签名证书链验证尚未实现。
- 共同招标模板可能造成内容相似，所有风险线索都需要结合业务证据人工复核。

## 架构

Electron 主进程持有文件权限，沙箱化渲染进程仅通过有限 IPC 调用。`src/analyzer.js` 负责只读解析和确定性检测规则，`src/cleaner.js` 负责 Office/PDF 元数据写入与验证，`src/reports.js` 负责报告导出，`src/ui` 负责界面展示和交互。依赖版本由 `package-lock.json` 固定。

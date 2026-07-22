<div align="center">
  <img src="src/ui/assets/tenderguard-logo.svg" width="92" alt="TenderGuard logo">
  <h1>TenderGuard</h1>
  <p>本地化供应商投标文件审查与元数据编辑工作台</p>
</div>

TenderGuard 是一款默认离线运行的桌面专业工具。它将“多家供应商批量审查”和“文件属性编辑”拆分为两个独立工作台，用确定性规则检查文件一致性与元数据关联，并保留完整的人工操作记录。

检测结果只用于提供人工复核线索，不直接作出串标、违法或其他法律定性结论。

## 两个独立工作台

### 多家供应商批量审查

每个上传的 ZIP 代表一家供应商，ZIP 文件名即供应商名称。审查结果分为三个连续区域：

1. **文件审查**：按供应商逐列展示 ZIP 文件名、文件数、文件大小、类型分布和解析异常，同时汇总整体一致的供应商包。文件采用带序号的折叠卡，完整路径自动换行，并直接展示作者、最后保存者、程序名称、公司、管理者、创建与修改时间等关键字段。每家供应商的第一个文件默认展开，也可以一键全部展开或全部收起。
2. **属性重复审查**：所有非空重复值都会列出并分成高、中、低风险。Office 重点检查作者、最后一次保存者、修订号、版本号、程序名称、公司、管理者、创建时间和保存时间；PDF 检查作者、标题、主题、关键词、创建程序、制作工具及时间字段；图片检查作者、标题、说明与创建软件。
3. **操作记录**：记录属性修改、删除、保存、另存为、输出路径和写入前后 SHA-256，并可导出操作报告。

“文件审查”支持“仅查看相同文件”和“仅查看属性重复文件”两个组合筛选。关键字段即使没有值也会显示为 `<空>`。文件路径使用浅色目录与深色文件名区分；相同文件或重复属性会紧跟可悬停的问题 Tag，说明与哪些完整路径的文件、哪些字段和值相同。完全相同文件仍始终按 SHA-256 计算，不受首页“是否作为风险”选项影响。点击“查看更多与编辑”会在右侧固定打开属性编辑器，无需离开批量审查页面。供应商包整体内容完全一致等致命问题使用红色提示。

### 文件属性编辑器

用于直接打开 Office、PDF、图片或文本文件，集中查看文件属性，并对支持的 Office/PDF 元数据进行修改、删除、保存或另存为。它与供应商批量审查使用不同的页面和导航结构。

左侧文件栏和右侧属性区可以拖动调整宽度；长文件名和完整路径自动换行。文件栏右上角的“＋”可以继续添加文件。右侧属性段默认全部展开，并提供行业通用的 `+ / −`“全部展开 / 全部收起”图标。

## PDF 元数据

PDF 的“说明”区域在同一属性行中并列展示：

- 传统 PDF Info Dictionary，例如 `/Author`、`/Title`、`/Creator`、`/Producer`。
- XMP Metadata Stream，例如 `dc:creator`、`dc:title`、`xmp:CreatorTool`、`pdf:Producer`。

Info 与 XMP 默认联动，修改一侧会同步另一侧。也可以按属性解除关联并分别编辑，此时界面会分两行提示：

```text
部分 Info 与 XMP 已解除关联，不同阅读器可能显示不同值。
已保存并验证，可以继续编辑。
```

保存后编辑器不会被销毁或重建，当前输入框仍可继续获得光标并进行下一次修改。

## 支持的文件

- Office Open XML：DOCX、DOCM、XLSX、XLSM、PPTX、PPTM
- PDF
- 图片：PNG、JPEG、TIFF、WebP 等常见格式
- 文本：TXT、CSV、XML、JSON、HTML

旧式二进制 DOC、XLS、PPT 仅识别类型，不进行深层属性解析。加密 Office/PDF 只报告状态，不绕过密码或权限限制。

## Windows 开发运行

建议使用 Node.js 20 或更高版本：

```powershell
cd E:\github\volnet\tender-guard
npm.cmd install
npm.cmd start
```

如果 Electron 下载不完整并提示 `Electron failed to install correctly`：

```powershell
Remove-Item -Recurse -Force .\node_modules\electron
npm.cmd install
npm.cmd start
```

## 测试与构建

```powershell
npm.cmd test
npm.cmd run dist:win
```

Windows 安装程序输出为：

```text
dist\TenderGuard-2.0.0-Setup.exe
```

macOS 安装包需要在 macOS 构建机上生成：

```bash
npm run dist:mac
```

正式对外分发时应配置对应平台的代码签名。

## 命令行审查

```powershell
node src\cli.js tests\供应商A.zip tests\供应商B.zip --out tests-output
```

输出包括 TenderGuard 项目 JSON、Excel 操作报告、HTML 报告和 PDF 报告。

## 安全与数据

- 分析过程在本机完成，不包含遥测、联网 API 或在线 AI。
- 只有用户明确点击“保存”时才覆盖本地原文件；“另存为”不会修改原文件。
- ZIP 内文件默认只读，属性修改通过“另存为”输出独立文件。
- 元数据写入使用临时文件和备份替换流程，完成后重新读取验证。
- 宏和 PDF JavaScript 只识别、不执行。
- ZIP 解析包含路径穿越、符号链接、条目数量、单文件大小、总体积与压缩比限制。
- 真实投标文件、解压内容、检测数据库和报告不应提交到仓库。

## 技术结构

- `src/analyzer.js`：文件识别、Office/PDF/图片属性解析和确定性风险规则。
- `src/audit.js`：供应商汇总、ZIP 清单一致性、相同文件与核心属性重复风险分组。
- `src/cleaner.js`：Office/PDF 元数据写入、Info/XMP 同步和写后验证。
- `src/reports.js`：项目、供应商、相同文件、属性重复与操作记录报告。
- `src/ui`：类似专业代码编辑器的信息架构、供应商工作台与属性编辑器。

依赖版本由 `package-lock.json` 固定。

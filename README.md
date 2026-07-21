# 投标慧眼 TenderLens

一款默认离线、原件只读的桌面投标文件异常关联检测工具。它批量读取每家供应商的 ZIP，保留文件路径、原始属性值、SHA-256 和判断依据，输出“异常关联 / 同源风险 / 建议人工复核”，不会输出串标或法律结论。

## 运行

要求仅限开发机：Node.js 20+。终端执行：

```powershell
D:\nodejs\npm.cmd install
D:\nodejs\npm.cmd start
```

最终用户不需要 Node.js；使用 `dist` 中的安装程序双击安装。命令行批量检测：

```powershell
node src/cli.js tests\甲.zip tests\乙.zip --out tests-output
```

## 已实现

- 多 ZIP 选择、拖放、供应商名自动取自 ZIP 文件名、进度与错误提示。
- 检测维度可勾选：完全相同文件、元数据、SimHash、Excel 公式、图片指纹。
- “全部文件与属性”按常见属性、文档专有属性、SimHash/内容指纹、路径与安全信息折叠展示。
- 支持任意挑选 Office、PDF、图片或文本文件进行单文件属性检查，不要求先打包 ZIP。
- 每个可处理文件可勾选作者、最后保存作者、公司、时间、版本、模板等属性，另存为清理副本；永不覆盖原件。
- ZIP 路径穿越、符号链接、条目数、单文件、总解压量和压缩比限制；宏与 PDF JavaScript 只识别、不执行。
- 文件真实签名识别和 SHA-256；DOCX/XLSX/PPTX 的核心属性、公司/管理者、时间、模板、文档 ID、路径、链接、媒体、宏、Excel 隐藏 Sheet 与公式；PDF 信息字典、ID、签名、加密、JavaScript；图片原始哈希。
- 跨供应商相同文件、作者/编辑人、公司、模板、ID、本地路径、链接、图片、公式结构和文本 SimHash 线索；每条风险保留证据、解释和复核建议。
- 人工复核状态；项目 JSON 持久化；PDF、Excel、HTML、JSON 导出。
- 系统浅色/深色模式和简化三步流程。

## 测试与构建

```powershell
D:\nodejs\npm.cmd test
D:\nodejs\npm.cmd run dist:win
D:\nodejs\npm.cmd run dist:mac
```

macOS 安装包必须在 macOS 构建机上生成；未签名包可供内部测试，正式分发需要 Apple Developer ID 与公证。Windows 未签名安装包可能出现 SmartScreen 提示。

## 安全与数据

软件不包含遥测、联网 API 或在线 AI。真实投标文件、解压内容、检测数据库及报告不得提交到仓库，相关路径已加入 `.gitignore`。原始 ZIP 只读；解析内容在内存或操作系统临时目录中处理，临时 OOXML 副本用后立即删除。

## 已知限制

- 第一版不对旧式二进制 DOC/XLS/PPT 做深层属性解析，只识别并记录；加密 Office/PDF 只报告状态。
- PDF 文本提取与 OCR、HEIC 感知哈希、VBA 源码反编译、数字签名证书链验证、SQLite 项目库及属性清理副本尚未实现。
- 桌面端 PDF 报告使用 Chromium 和系统中文字体排版，完整保留中文；命令行直接生成 PDF 仍为兼容性后备路径。
- 共同招标模板可能造成内容相似，需人工复核；常见软件与通用作者不会单独形成高风险结论。

## 架构

Electron 主进程持有全部文件权限；沙箱化渲染进程仅通过有限 IPC 调用。`analyzer.js` 执行只读解析与确定性规则，`reports.js` 负责导出，`ui` 只负责展示。依赖版本由 `package-lock.json` 固定。

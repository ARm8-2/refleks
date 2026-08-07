## Context

RefleK's 是 Go/Wails 桌面应用，React 前端通过生成的 Wails 绑定访问 Go 服务。当前所有固定界面文案直接写在 TSX/TypeScript 中，多处日期和数字格式器在模块级固定为 `en-US`；Settings 由 Go 写入 `~/.refleks/settings.json`，前端在 React 已挂载后异步读取。项目没有 i18n 依赖、语言资源、语言字段或前端测试框架。

这是一项跨越启动流程、Settings、全部前端业务模块和少量 IPC 状态结构的改动。首期只交付英文和简体中文；资源和解析边界允许后续增加日语、韩语等从左到右语言而不修改业务组件。RTL 布局不在本次能力承诺内，增加 RTL 语言前必须单独设计方向、镜像和图表布局。

## Goals / Non-Goals

**Goals:**

- 为所有固定用户可见文案提供英文和简体中文资源。
- 首次没有已保存语言时根据操作系统当前语言选择英文或简体中文，并在不重启应用的情况下切换。
- 让日期、时间、数字、时长、星期、月份和复数规则跟随当前语言。
- 以英文作为完整基准资源和运行时最终回退。
- 阻止后端英文状态或技术错误直接进入用户界面。
- 通过自动检查保证语言资源结构一致，并覆盖设置迁移和语言解析规则。

**Non-Goals:**

- 不翻译 KovaaK's 场景名、Benchmark 官方名称、等级和分类、玩家内容、文件路径、版本号及技术日志。
- 不翻译服务端或外部数据源返回的自由文本。
- 不提供在线语言包下载、社区翻译平台或运行时编辑器。
- 不在首期支持简体中文和英文之外的语言。
- 不在首期支持 RTL 语言和界面方向切换。
- 不改变训练记录、Benchmark、回放或同步数据格式。

## Decisions

### 使用 i18next 和 react-i18next

前端增加 `i18next` 与 `react-i18next`，语言资源以静态 JSON 随桌面包发布。资源按 `common`、`overview`、`history`、`benchmarks`、`settings`、`welcome`、`errors` 命名空间拆分，避免单个巨型字典，也不按组件切出大量碎文件。

业务组件使用稳定语义键，例如 `overview:session.empty`，不使用英文原句作为键。英文资源是基准合同；简体中文必须具有相同键结构。相比引入编译期消息提取工具，显式语义键更适合当前没有文案流水线、只有两个内置语言的桌面应用，也更容易按现有 feature 目录渐进迁移。

所有资源静态导入，不增加懒加载、网络请求或语言包版本协议。两个语言包的体积远小于应用现有前端资源，运行时加载层没有价值。

TypeScript 的 `resolveJsonModule` 已启用。正式脚本从英文 JSON 生成并校验 i18next 类型声明，声明包含命名空间、key 和命名插值参数，再通过 `CustomTypeOptions` 约束 `t()`。生成声明纳入版本控制，`check:i18n` 验证它与英文资源一致，避免陈旧类型掩盖资源变更。业务代码不得用任意字符串拼接翻译 key；有限状态必须先收窄为 union，再通过完整映射得到 key。构建校验同时使用 TypeScript AST 扫描静态 `t()`/`<Trans>` 引用，防止类型逃逸或显式断言绕过后引用不存在的 key。

包含链接、强调、代码或换行的富文本使用 `<Trans>` 和调用方提供的受控 React 组件。语言 JSON 不保存 HTML，代码不得用 `dangerouslySetInnerHTML` 渲染翻译内容；普通动态值统一使用命名插值。

### Go Settings 是语言选择的唯一持有者

`models.Settings` 增加可选的 `Language string` 字段，持久化后的合法值只有 `en` 和 `zh-CN`。字段缺失、空值或非法值统一表示“尚未初始化”，只是启动过程中的内部状态，不是设置页可选项；默认 Settings 不写入伪语言值。已有 `settings.json` 缺少该字段时保留其他设置，并在本地化版本首次启动时完成一次语言初始化。

语言不再复制到 localStorage。前端启动函数在 `createRoot(...).render(...)` 之前读取 Settings：合法的 `en` 或 `zh-CN` 直接用于初始化 i18next；没有合法值时读取 `navigator.language`，主语言为 `zh` 则选择 `zh-CN`，其他情况选择 `en`，并立即通过现有 Settings API 持久化。Settings 读取失败或超时时不得覆盖可能存在的用户选择，本次会话使用英文回退并记录技术错误。这样既避免错误语言闪烁，也避免两个持久化来源冲突。

Settings 页面现有保存器按顺序提交完整 Settings 快照。它需要改成以“最新本地快照”为输入的单一串行队列：语言选择先更新最新本地快照并进入同一队列，只有包含该语言的快照成功持久化后才调用 `i18n.changeLanguage`。语言保存期间禁用语言选择器；保存失败时选择器和本地 Settings 回滚到最后一次成功提交的语言，并显示本地化错误。不得为语言另开一条 `UpdateSettings` 通道，也不得让较早排队的完整快照在语言提交后覆盖新值。

Reset Settings 必须先等待保存队列结束，再执行后端重置、重新读取完整 Settings，并在同一次前端状态更新中重新应用 theme、font 和 language。配置重置必须保留最后一次成功持久化的语言，不能再次检测操作系统语言。切换或重置成功后同步更新 `document.documentElement.lang`；失败时保留最后一次已提交语言。

### 系统语言只在未初始化时检测一次

只有 Settings 没有合法语言时才检查 `navigator.language`。主语言为 `zh` 的所有区域标签均初始化为 `zh-CN`；其他语言统一初始化为 `en`。检测结果一旦保存，后续启动、配置重置和操作系统语言变化都不再触发自动检测；用户只能在 Settings 中明确选择 `en` 或 `zh-CN`。

### 区域格式集中到当前语言上下文

删除所有固定 `en-US` 的模块级 formatter。新增集中式 locale 工具和 `useLocaleFormat` hook，按 i18next 当前语言创建并缓存 `Intl.DateTimeFormat`、`Intl.NumberFormat`、`Intl.PluralRules` 和 `Intl.Collator`。业务组件只传语义数据和格式选项，不自行选择 locale。

存储语言与 Intl locale 的映射固定为 `en -> en-US`、`zh-CN -> zh-CN`。日期解析、时间戳含义、数值缩放、精度、单位和业务排序规则保持现有语义：本地时间继续使用运行机器时区，现有明确 UTC 的位置继续使用 UTC；语言切换只改变字段顺序、月份/星期名称、12/24 小时展示、分组符和小数符。分数、百分比、文件大小和时长不得因本地化重复乘除或改变原始精度。代码拥有的已翻译标签使用当前 locale 的 `Intl.Collator` 排序；场景名、Benchmark 名和其他源数据继续使用现有稳定比较器。

格式切换必须和文案切换发生在同一次 React 更新中。场景得分等数值仍保持原始数值用于排序、计算和图表；只有最终展示层格式化。formatter 测试固定时区和输入时间，避免依赖执行机器区域设置产生漂移。

### 固定中文术语和字体回退

简体中文资源遵守以下核心术语，不允许各 feature 自行创造同义词：

| English | 简体中文 |
| --- | --- |
| RefleK's | RefleK's |
| RefleK's Index | RefleK's Index |
| Run | 训练记录 |
| Session | 训练会话 |
| Scenario | 场景 |
| Benchmark | 基准 |
| Rank | 等级 |
| Score | 分数 |
| Replay | 回放 |
| Mouse Trace | 鼠标轨迹 |
| Screen Capture / Recording | 屏幕录制 |
| Anonymous Mode | 匿名模式 |

品牌名、Steam、KovaaK's、FFmpeg、分辨率和硬件编码器名称保持原文。中文句子使用全角中文标点；路径、版本、快捷键、单位符号和插值值保持原始字符。新增术语必须先补充本表，再进入多个命名空间。

不引入新的大型 CJK 字体文件。`zh-CN` 下的 UI 字体栈在现有拉丁字体后显式提供 `Microsoft YaHei UI`、`Microsoft YaHei`、`Noto Sans CJK SC` 和系统 sans-serif 回退；等宽内容保留 JetBrains Mono，并为中文字符使用相同 CJK 回退。视觉验收必须检查混排基线、字重和控件高度。

### 用户可见失败和状态使用稳定消息码，技术细节只进日志

这里的“用户可见失败和状态”是指应用可以正常识别、需要反馈给用户的结果，例如回放处理中、没有回放、回放处理失败、录屏不可用或设置保存失败；不是指“用户犯了错误”。

Go 后端返回给 React 前端的数据，以及通过 Wails 事件推送给前端的数据，都属于跨 Wails 边界的数据。边界上只传稳定的消息码和参数，不传由 Go 直接写死的英文界面文案：

```text
messageCode: string
messageParams?: Record<string, string | number | boolean>
```

`messageCode` 使用 `<domain>.<reason>` 形式，例如 `replay.processing` 或 `replay.failed`，前端再把它映射到 `errors` 命名空间的英文或简体中文文案。需要动态内容时通过 `messageParams` 传值；参数只能是 JSON 原始值，禁止嵌套对象、错误栈和任意 HTML。比如回放失败传递 `replay.failed`，而不是传递 `Replay processing failed.`。

`ReplayStatus` 查询结果和 `replay:status` 事件使用完全相同的 `messageCode`、`messageParams` 字段；面向应用的 `ScreenCaptureInfo` 也使用相同约定。内部 `lastError` 可能包含 FFmpeg、D3D 或文件系统细节，只进入 Go 日志，不再序列化给前端。未知或缺失 `messageCode` 记录 code 与参数并显示 `errors:generic.unexpected`。

Wails 方法 reject 的原始 `error` 仍是技术异常，不属于可翻译的业务状态：API 调用点将完整错误写入 console/Go 日志，用户界面只选择操作级通用 key，例如 `errors:settings.saveFailed` 或 `errors:update.checkFailed`。不从 `Error.message` 文本反推错误类型。

React 渲染异常由 ErrorBoundary 兜底，它也不是后端业务状态。ErrorBoundary 改为可接收 translator 的边界组件：生产构建只显示本地化通用标题和恢复操作，不渲染 `error.message`、JavaScript stack 或 component stack；开发构建允许在折叠详情中显示这些诊断，同时始终写入 console。

不为所有 Wails 方法引入通用 Result 包装层。只有现有界面真正消费并展示的状态边界迁移为结构化消息，避免为假想错误类型重写全部 IPC。

### 语言资源完整性进入构建门禁

新增正式校验命令递归比较英文和简体中文资源的命名空间、键和插值变量，并检查代码引用的静态 key 存在。缺键、多键、插值变量不一致或无效代码引用时构建失败。`npm run build` 在 TypeScript/Vite 编译前执行该校验。

Go 增加 Settings 未初始化状态、旧配置迁移、合法语言持久化、非法语言恢复和消息 DTO 测试。前端测试固定使用 Vitest、Testing Library 和 jsdom，覆盖首次语言检测、已保存语言不再检测、英文回退、typed key、formatter、Settings 保存竞态和错误回退；不再为实现阶段保留测试框架选择。

浏览器验收固定为 `1500x900` 默认窗口和 `1024x720` 窄窗口，设备缩放为 100%。测试进程使用临时 `USERPROFILE`/`HOME`，并通过现有 `REFLEKS_KOVAAKS_INSTALL_DIR` 指向仓库内脱敏的正式测试资料；禁止读取或写入开发机真实 `~/.refleks`、Steam 或 KovaaK's 目录。资料至少覆盖首次启动、空数据、填充 History、动态数字/日期、Replay 不可用状态和长文本。无法由真实数据稳定触发的 processing/failed 状态通过前端组件测试注入 typed DTO，不增加生产运行时测试开关。

截图矩阵覆盖 Sidebar、Welcome、Settings 基础/高级区、Overview、History 列表与详情、Replay、Benchmarks 列表与详情，以及通用错误界面；每个状态分别运行英文和简体中文。验收检查必需文本完整可见、控件不重叠、图表标签可读、中文字体回退一致，并保存失败截图用于定位。

## Risks / Trade-offs

- [一次迁移大量固定文案，容易漏项] -> 先建立资源和门禁，再按公共布局及 feature 逐块迁移；最终用固定英文扫描和关键页面浏览器检查收口。
- [翻译后文本长度变化导致布局溢出] -> 中英文都检查窄窗口和默认窗口，优先修正弹性布局和文本换行，不用截断掩盖问题。
- [外部业务数据与固定 UI 文案边界混淆] -> 只翻译代码拥有的固定标签；所有场景、Benchmark 和用户数据原样透传。
- [缺失键造成界面显示键名] -> 英文完整资源作为最终回退，构建期强制键和插值变量一致。
- [Settings 启动读取延迟] -> 在 React 挂载前只读取一次小型本地 JSON；读取失败或超时时使用英文完成本次启动，但不覆盖磁盘上可能存在的语言。
- [部分技术错误失去详细用户提示] -> 用户看到稳定、可翻译的通用错误，完整原始错误仍写入日志用于排障；已知可恢复错误逐个定义消息码。
- [完整 Settings 快照并发保存覆盖语言] -> 所有更新进入同一串行队列并以最新本地快照提交；语言只在对应提交成功后生效，重置前先排空队列。
- [代码拼错翻译 key 但语言包结构仍一致] -> 使用英文资源推导 TypeScript key 类型，并在构建期校验静态引用。
- [真实用户数据让视觉验证不可重复或污染环境] -> 使用临时用户目录和脱敏测试资料，进程级环境变量只作用于验收实例。

## Migration Plan

1. 增加依赖、typed key、i18n 初始化、首次语言检测、资源校验、术语表和基础英文/简体中文资源。
2. 扩展 Go Settings、消息 DTO 与生成绑定，完成旧配置迁移、一次性语言持久化、统一保存队列和启动前语言初始化。
3. 建立 formatter、错误回退和富文本规则，迁移公共布局、Welcome、Settings 和公共组件。
4. 依次迁移 Overview、History、Benchmarks，替换固定 locale formatter 和用户可见自由文本状态。
5. 建立隔离测试资料，运行资源校验、单元测试、前端构建、Go 测试、Wails 构建和固定截图矩阵。

回滚时同时移除语言字段消费、i18n 初始化和资源调用，恢复英文常量；已有 settings 文件中的未知 `language` 字段会被 Go JSON 解码器忽略，不阻塞旧版本启动。

## Open Questions

无。首期语言范围、回退规则、非翻译数据边界和错误处理边界均已确定。

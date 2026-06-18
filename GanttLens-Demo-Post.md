# GanttLens —— 一个非程序员做的施工项目甘特图

> **作者**：Cailleach（邹景焘）· 弱电智能化设计师
> **工具**：TRAE IDE
> **Demo**：[cailleachzou.github.io/ganntlens](https://cailleachzou.github.io/ganntlens/)
> **代码**：[github.com/cailleachzou/ganntlens](https://github.com/cailleachzou/ganntlens)
> **Session ID**：
> - `3928979018359690:a0f4ae9c578a4ac38a8e8e2942754e46_6a3107250aa837c4de6b74d2.6a310e930aa837c4de6b76c6.6a310e930aa837c4de6b76c4:TRAE Work CN.0.1.19.no_sid.no_ppe.T(2026/6/16 16:51:31)`（D1-D2 大甘特图 + 共享时间轴）
> - `3928979018359690:2ee16ab9c6bd4a0910b728955f9cbd99_6a3107250aa837c4de6b74d2.6a3109d70aa837c4de6b7594.6a3109d70aa837c4de6b7592:TRAE Work CN.0.1.19.no_sid.no_ppe.T(2026/6/16 16:31:19)`（D3 节点下钻 4-Tab 抽屉）
> - `3928979018359690:e8b463a795a9180b4981ce865712aa43_6a325035244476575c84e522.6a3253ec244476575c84e58c.6a3253ec244476575c84e58a:TRAE Work CN.0.1.19.no_sid.no_ppe.T(2026/6/17 15:59:40)`（D4 Hover v9 + 抽屉 v9）
> - `3928979018359690:378a67725405ff904ec0b6d025773104_6a325035244476575c84e522.6a335f4fbdc087dbd2f48ccf.6a335f4fbdc087dbd2f48ccd:TRAE Work CN.0.1.19.no_sid.no_ppe.T(2026/6/18 11:00:31)`（D4 chips 推翻 + M1/M2 阶段边界）
> - `3928979018359690:56d6f6b2026b5b40518bc72ea5a7fc7b_6a325035244476575c84e522.6a336a77bdc087dbd2f48ec0.6a336a77bdc087dbd2f48ebe:TRAE Work CN.0.1.19.no_sid.no_ppe.T(2026/6/18 11:48:07)`（D4 GitHub Pages 部署）

---

## 先说我是谁

我做弱电智能化设计十来年，办公室、数据中心、安防这类项目都做过。一个项目从设计到验收 3-6 个月，手上同时跑 5-10 个是常态。

我**不写代码**。CSS 是啥、git 怎么 push、Vite 是什么——我原来都只知道个名字。这次做 GanttLens，从头到尾是 Vibe Coding：把脑子里的需求告诉 TRAE，让它写，我提"这不对、那不行"。

为什么我这种"业务人"会自己动手做工具？因为工作里那种痛，受够了。

---

## 痛点：5 个文档来回切

做项目管理最烦的不是"画甘特图"，是这几件事同时发生：

- 计划在 Excel
- 阶段交付物在 NAS
- 里程碑的"完成依据"在文件柜
- 客户进度更新在微信群
- AI 建议在我脑子里

我想知道"现在到哪了、下一步干啥、谁卡着"——得开 5 个文档。

更蠢的是问 ChatGPT 项目状态，它得先读完我那 50 个文档。我想要的是"直接告诉我 M-2026 验收测试 50% 该不该担心"。

---

## 这东西到底干了啥

GanttLens 干了一件事：把"看进度"和"看细节"塞进一个屏幕。

![GanttLens 主界面](upload://2Y9F1wTS3tYZzIfwaAkcqYDbhCE.png)

3 个项目（OFC-2026 / DC-2026 / M-2026）共享一根时间轴，谁先完工、谁抢资源一眼看到。设计/施工/验收三色背景 + 一根红色 today line，今天是 6-18、谁在拖、谁抢回，不用解释就能看懂。

点任意任务条或里程碑 → 右边滑出抽屉，4 个 Tab：详情 / 文件 / 活动 / AI 建议。**抽屉这个选择是我自己坚持的**——不要新页面、不要模态框。实际工作里我打开详情不是要跳走，是"瞄一眼继续干"，抽屉不抢主图。

悬停任务条还会弹个预览小卡，250ms 延迟防误触、靠右会翻转、点任务后立即消失。这个细节返工过一次，后面会讲。

AI 入口有两个：Overview 页全局 AI、详情页项目级 AI。`/move M1 +7d`、`/risk overview` 这类自然语言命令也能跑。

---

## 这 4 天我都在干吗

按主题回忆，不按 Day 排——

### 大甘特图：3 张草图选 1 张

最早画了 3 张草图，3 种排布方式。最后选"所有项目共享一根时间轴"——因为项目最关心的是"跨项目比工期"，不是"单项目看阶段"。

D1 搭脚手架（Vite + React + TS + Zustand，这几个词我也是边写边学），D2 写完 3 个脱敏项目，跑出第一张大甘特图。

那天最大的坑：`dateToPercent` 函数算天数时少了一个 `Math.round`——5 月 15 日在 timeline 上偏了半格，盯着屏幕看半小时才发现是浮点误差。

这种"非程序员会栽的跟头"，是这次最有意思的部分：**我不懂 `Math.round` 为什么必要，但 5 月 15 偏半格我能看出来**。

### 节点下钻 4-Tab 抽屉：最值的部分

D3 做的，也是我最想要的功能。

不是模态框、不是新页面、就是侧滑抽屉 + 4 个 Tab。原因前面说了：实际工作里我打开详情不是要跳走，是"瞄一眼继续干"，抽屉刚好不抢上下文。

一开始我选了 380px 宽，TRAE 说"再窄点给主图留呼吸"，我调成 320px 立刻好很多。这种"AI 帮你做减法"的瞬间挺爽——它不会替我决定，但会指出我没看到的余地。

### Hover 预览卡 v8 → v9：一次教科书般的"返工"

D4 翻车了。原计划写完 hover 卡就收工，用 Playwright 验证发现：

- 鼠标快速划过任务条时 hover 卡疯狂闪（防误触缺失）
- 卡片超出右边界时被截掉一半（边界处理缺失）
- 任务条点击后 hover 卡不消失（生命周期缺失）

我直接说"这版不行，重做"。TRAE 给的 v9 方案我挺满意：

1. 鼠标进入延迟 250ms、离开 100ms（用 `setTimeout` 取消）
2. 卡片靠右时 `flip` 镜像显示
3. 抽屉打开时 `hoverSuppressed=true` 立即隐藏
4. `useRef` 跟踪 150ms 点击抗误触

![Hover 预览卡 v9](upload://z5rHpLVLRe8IxEL5lv6hqAmhtU0.png)

最后 `verify-day4.py` 7/7 通过。

这次返工最爽的地方：我不懂这些 250ms / 100ms / 150ms 是怎么算出来的，但我能看出来"翻车了"。**非程序员的核心能力不是写代码，是定义"翻车了"**。

### 推翻三栏布局：一次"Vibe Coding 价值观"现身

D4 收尾时我做了一版"左侧 3 个项目 chips + 中间大甘特图 + 右侧跨项目面板"的三栏布局。TRAE 还加了"hover 上去联动右侧"的特效。

我自己看了页面 5 分钟，**直接推翻**：

> "既然实际交互在顶上，就不要左侧的 projects，这些框其实没用。"
> "把整个甘特图长度拉长到左边。"

这次推翻让甘特图从 1303px 直接拉到 1560px，**timeline 跟 gantt zone 也终于对齐了**（之前 chips 占的 290px 让 GanttChart 整体偏移，timeline 起点看着像在 5 月 22 日，其实 M-2026 是 3 月 15 日开始的）。

![chips 移到顶部 + 甘特图占满全宽](chips 移到顶部 + 甘特图占满全宽 - 1560px 视野 + 时间轴对齐)

我后来想明白一件事：**Vibe Coding 最值的地方不是"AI 干得快"，是"推翻 AI 干得动"**——我敢说"这版不行"的前提，是重写成本几乎为零。

### M1/M2 节点位置修复：阶段交界处不是项目起讫

里程碑位置一开始是"项目开始 / 项目结束"，我自己看了 3 秒就发现不对：

> "M1 和 M2 的节点位置有问题，应该在设计-施工-交付 两条线的中间位置，不是在最前或末端。"

M1（设计→施工）菱形应该在设计阶段的最后一天，M2（施工→验收）应该在施工阶段的最后一天。我把 6 个 milestone 的 date 全部改成 `design.planEnd` 和 `construction.planEnd`：

```ts
// OFC-2026
{ id: 'm1', date: '2026-06-30', betweenPhases: ['design', 'construction'] },
{ id: 'm2', date: '2026-09-15', betweenPhases: ['construction', 'acceptance'] },
```

![M1/M2 阶段交界处](upload://fzvn2fhgaItb3RaFylVwt5aqtVa.png)

DC-2026 改的时候出了 race condition：3 个 Edit 并行，DC-2026 那次没生效。我又串行重跑了一次才改对。

### GitHub Pages 部署：5 个配置坑

最后一步是让评审点得开。我用 `gh repo create` 建了 `cailleachzou/ganntlens` 公仓，配 `gh-pages` 部署。踩了 5 个坑：

1. **vite base 路径**：`base: '/ganntlens/'`——不然资源 404
2. **React Router basename**：`BrowserRouter basename={...}`——不然站内链接跳到 `cailleachzou.github.io/` 根目录
3. **SPA 404 fallback**：GitHub Pages 不支持 SPA 自动 fallback，我加了个 `cp dist/index.html dist/404.html` 的步骤
4. **import.meta.env 类型**：tsconfig 没装 vite/client 类型，typecheck 红了一屏，加 `/// <reference types="vite/client" />` 修好
5. **首次部署没跑**：push 代码后 Pages 没自动跑 workflow，得手动 `gh api -X POST /repos/.../pages -f build_type=workflow` 启用

![GitHub Pages 部署](upload://sIAMgp5XhvT0AOI7jLixsGzYKF0.png)

现在 push 就自动部署，2 次 success，1.4px 时间轴像素都对齐了。

---

## 我自己最看重的 3 个点

### 1. 节点下钻 = 同屏抽屉，不是新页面

传统项目管理工具是"点项目 → 新页面"。GanttLens 是"点节点 → 抽屉滑出"。差别看着小，实际是"我能不能不丢上下文拿信息"。

这一条是我作为 PM 反复验证过的：开新页面我会迷掉，开抽屉我下一眼还能回到甘特图。

### 2. 计划 vs 实际双轨

每个 task bar 支持 `actualStart/actualEnd`，跟 `planStart/planEnd` 同屏显示。M-2026 的"系统调试"计划 5-21 ~ 6-5，实际 5-21 ~ 6-4（提前 1 天）—— 一眼能看到哪些任务拖延、哪些抢回。

这个不是技术难，是"传统甘特图工具不重视"——它们默认计划 = 实际，但我们做工程的知道"计划"是开工会签的那张纸，"实际"是工人今天到底做到哪了。

### 3. 三色阶段带 + today line

设计（蓝）/ 施工（黄）/ 验收（绿）三色背景 + 一根红色 today line。跨项目看过去，3 个项目分别处于三阶段，一个屏幕就能跟老板讲清楚"现在 M-2026 验收测试 50%、DC-2026 桥架安装 30%、OFC-2026 图纸审核 0%"。

---

## 翻过的车（顺带给非技术背景的同行）

### 车 1：DC-2026 milestone race condition

3 个 Edit 并行调度，DC-2026 那次没生效。原因：并行 Edit 的 `old_string` 匹配 race——一次成功的 Edit 改了文件后，另一次 Edit 的 `old_string` 找不到内容。

经验：批量改同类数据时串行更稳，或用 `replace_all`。

### 车 2：今日线出现 3 次

D3 跑通时 today line 在每行 project row 出现 3 次（不是 1 次），因为我把 `TodayLine` 组件放在 `ProjectRow` 里了。改成顶层 `GanttChart` 容器内只渲染一次解决。

经验：共享元素放顶层，per-row 元素放 row 内。

### 车 3：抽屉"假死"

D4 第一次写抽屉时，点了关闭按钮后状态变量改了但 DOM 没卸载——因为我用了条件渲染 `isOpen && <Drawer />`，但 CSS 动画结束后才卸载。改成"挂载即用，状态机控制 `isOpen`"。

经验：状态机比条件渲染更适合动画 + 卸载。

---

## 一句话反思

Vibe Coding 的核心收益不是"AI 干得快"，是"推翻 AI 干得动"。

我作为非程序员，能在 4 天内从 0 到 GitHub Pages 上线——**不是因为我会写代码，是因为我敢说"这版不行，重做"，而且重做的成本是几分钟**。

---

## 接下来想做的

1. **Gantt 拖拽编辑**：D6 计划做。鼠标拖动任务条直接改 `planEnd`，跟 D5 的 `/move` 命令形成"AI 命令 + 手动拖拽"双通道
2. **多用户协作**：D7 计划做。Yjs / Liveblocks 做实时同步，hover 状态、抽屉打开状态多端可见
3. **真实 LLM 接入**：现在 OpenAI/Anthropic 是占位，留了 `providers.ts` 接口，填 API key 即可
4. **导入 MS Project / Excel**：实际工作中项目数据来自 MS Project 和 Excel，做个 import 工具
5. **甘特图 ↔ 看板视图切换**：同一个项目数据，4-Tab 抽屉复用，只换外层视图

---

## 致谢

感谢 **TRAE AI 创造力大赛** 给我这次机会，把脑子里想了很久的"节点下钻式甘特图"想法落了地——没有这个契机，我大概率还是会在 Excel 和 PPT 之间来回切，然后感慨"哎，下次再说"。

工具方面感谢 **TRAE IDE**，陪我走完从脚手架到 GitHub Pages 部署的全过程，特别是推翻 chips 布局、D4 hover v9 边界翻转、GitHub Pages 5 个坑这几段，让我意识到 Vibe Coding 的核心价值是"推翻 AI 干得动"。

**作者**：Cailleach（邹景焘）· 弱电智能化设计师
**工具**：TRAE IDE
**链接**：[Demo](https://cailleachzou.github.io/ganntlens/) · [代码](https://github.com/cailleachzou/ganntlens) · [入围链接](https://forum.trae.cn/t/topic/23972)

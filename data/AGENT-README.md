---
type: agent-readme
lastModifiedBy: cailleach
lastModifiedAt: 2026-06-18
---

# GanttLens AGENT 入门

你是同事的 Trae IDE / Claude Code AGENT，工作目录是 GanttLens 的 `data/` 目录。
你的工作方式：**直接 Edit JSON / md 文件**。不要试图改源码（源码是 Vite 跑的，AGENT 不要动）。

## data/ 结构

- `manifest.json` —— 项目清单（**不要改**，由 GanttLens 维护）
- `projects/<id>/` —— 一个项目一个文件夹
  - `project.json` —— 甘特核心（phases / milestones / tasks）
  - `files.json` —— 抽屉「文件」Tab
  - `activities.json` —— 抽屉「活动」Tab
  - `ai-notes.json` —— 抽屉「AI 建议」Tab
  - `*.md` —— 你的笔记区（contacts / risks / weekly-log / equipment / readme）
- `locks/<id>.lock` —— 软锁（前端 UI 拖拽时会有，写盘前必查）

## 改 JSON 流程

1. **改盘前必查锁**：

   ```bash
   cat data/locks/<projectId>.lock
   ```

   - 存在 → 警告用户「前端 UI 正在编辑，2 分钟后失效；或问用户能否先停」
   - 不存在 → 继续

2. **读 project.json 当前内容**（用 Read 工具）

3. **Edit 工具改字段**（最小 diff，不要全量重写）

   示例：把 M1 延后 3 天

   ```diff
   -  { "id": "M1", "name": "M1 开工", "date": "2026-06-10", ... }
   +  { "id": "M1", "name": "M1 开工", "date": "2026-06-13", ... }
   ```

4. **维护 lastModifiedBy / lastModifiedAt**：

   在 project.json 顶层加：

   ```json
   { "lastModifiedBy": "agent-claude", "lastModifiedAt": "2026-06-18T15:30:00Z" }
   ```

5. **改完告诉用户**：「已改 m-2026/project.json，刷新 GanttLens 页面」

## 改 md 流程

随便改。**没有锁**。AGENT 专属区域。前端不解析 md。

## 严禁

- ❌ 不要改 manifest.json（项目清单由 GanttLens 维护）
- ❌ 不要绕过锁文件强写 JSON
- ❌ 不要写源码（`src/`、`server/`、`vite.config.ts`）
- ❌ 不要建子目录或挪文件位置
- ❌ 不要批量重写整个 JSON（用 Edit 工具做最小 diff）

## Schema 参考

见每个项目文件夹下的 `README.md` 第一节「本项目数据结构」。
类型定义见 `src/types/index.ts` 和 `src/types/data.ts`。

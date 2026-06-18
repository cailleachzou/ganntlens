---
projectId: dc-2026
type: readme
lastModifiedBy: cailleach
lastModifiedAt: 2026-06-18
---

# DC-2026 · 数据中心机房改造

## 项目背景

（待补充：客户、合同金额、关键节点、特殊约束）

## 本项目数据结构

- `project.json` 见 `src/types/data.ts` 的 `ProjectData` 类型
- 任务 ID 命名：`T-001` 起，里程碑 `M1` / `M2`，阶段 `design` / `construction` / `acceptance`
- 阶段/里程碑/任务联动规则见 [D6 spec](docs/superpowers/specs/2026-06-18-gantt-day6-drag-edit-design.md) §2.1

## 决策记录

- 2026-06-18 D7 起改 JSON 文件化（之前 D6 还在内存）

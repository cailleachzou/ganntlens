import type { Project } from '../../types';

// =====================================================================
// Seed 数据 - 3 个脱敏项目（按 2026-06-16 状态基线设计）
//
// 去敏规则：Tendo/江阴博物馆 → 某某/M-2026/DC-2026/OFC-2026
// 演示基线：今天 2026-06-16
//
// 三个项目在 6/16 分别处于不同阶段（总览按"从早到晚"设计→施工→验收排）：
//   01 / OFC-2026 某办公楼智能化 —— 前期·设计 进行中（图纸审核 0%）
//   02 / DC-2026 某数据中心机房   —— 中期·施工 进行中（桥架安装 30%）
//   03 / M-2026  某博物馆弱电集成 —— 后期·验收 进行中（验收测试 50%）
//
// 总览时间轴：2026-05-15 ~ 2026-10-05（约 145 天）
// 今天线 left ≈ 22%（32/143 天）
//
// 详见 docs/superpowers/specs/2026-06-16-three-projects-timeline-redesign.md
// =====================================================================

const today = '2026-06-16';

export const DEMO_TODAY = today;

export const seedProjects: Project[] = [
  // -----------------------------------------------------------------
  // 01 / OFC-2026 某办公楼智能化 — 前期·设计 进行中
  // -----------------------------------------------------------------
  {
    id: 'ofc-2026',
    code: 'OFC-2026',
    name: '某办公楼智能化',
    status: 'active',
    start: '2026-05-15',
    end: '2026-10-05',
    description: '智能楼宇 · BA/IBMS',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1,
        planStart: '2026-05-15', planEnd: '2026-06-30',
        actualStart: '2026-05-15' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2,
        planStart: '2026-07-01', planEnd: '2026-09-15' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3,
        planStart: '2026-09-16', planEnd: '2026-10-05' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-06-30',
        betweenPhases: ['design', 'construction'], status: 'reached' },
      { id: 'm2', name: 'M2 验收交付', date: '2026-09-15',
        betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '需求调研', phaseId: 'design',
        planStart: '2026-05-15', planEnd: '2026-05-25',
        actualStart: '2026-05-15', actualEnd: '2026-05-24', progress: 100, owner: '张工' },
      { id: 't2', name: '方案设计', phaseId: 'design',
        planStart: '2026-05-26', planEnd: '2026-06-15',
        actualStart: '2026-05-26', actualEnd: '2026-06-14', progress: 100, owner: '李工' },
      { id: 't3', name: '图纸审核', phaseId: 'design',
        planStart: '2026-06-16', planEnd: '2026-06-30', progress: 0, owner: '王工' },
      { id: 't4', name: '施工准备', phaseId: 'construction',
        planStart: '2026-07-01', planEnd: '2026-07-10', progress: 0, owner: '陈工' },
      { id: 't5', name: '设备安装', phaseId: 'construction',
        planStart: '2026-07-11', planEnd: '2026-08-20', progress: 0, owner: '陈工' },
      { id: 't6', name: '系统调试', phaseId: 'construction',
        planStart: '2026-08-21', planEnd: '2026-09-15', progress: 0, owner: '陈工' },
      { id: 't7', name: '验收交付', phaseId: 'acceptance',
        planStart: '2026-09-16', planEnd: '2026-10-05', progress: 0, owner: '某某' }
    ],
    files: [
      { id: 'f1', name: '设计文档', type: 'folder' },
      { id: 'f2', name: '需求调研报告.docx', type: 'file', ext: 'docx', parentId: 'f1' },
      { id: 'f3', name: '智能化系统方案 v2.docx', type: 'file', ext: 'docx', parentId: 'f1' },
      { id: 'f4', name: '图纸', type: 'folder' },
      { id: 'f5', name: 'BA 系统拓扑图.dwg', type: 'file', ext: 'dwg', parentId: 'f4' },
      { id: 'f6', name: 'IBMS 集成图.dwg', type: 'file', ext: 'dwg', parentId: 'f4' },
      { id: 'f7', name: '合同', type: 'folder' },
      { id: 'f8', name: '主合同.pdf', type: 'file', ext: 'pdf', parentId: 'f7' }
    ],
    activities: [],
    aiNotes: []
  },

  // -----------------------------------------------------------------
  // 02 / DC-2026 某数据中心机房 — 中期·施工 进行中
  // -----------------------------------------------------------------
  {
    id: 'dc-2026',
    code: 'DC-2026',
    name: '某数据中心机房',
    status: 'active',
    start: '2026-04-20',
    end: '2026-09-10',
    description: '机房弱电 · 综合布线',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1,
        planStart: '2026-04-20', planEnd: '2026-05-31',
        actualStart: '2026-04-20', actualEnd: '2026-05-30' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2,
        planStart: '2026-06-01', planEnd: '2026-08-20',
        actualStart: '2026-06-01' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3,
        planStart: '2026-08-21', planEnd: '2026-09-10' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-05-31',
        betweenPhases: ['design', 'construction'], status: 'reached' },
      { id: 'm2', name: 'M2 验收交付', date: '2026-08-20',
        betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '需求确认', phaseId: 'design',
        planStart: '2026-04-20', planEnd: '2026-04-30',
        actualStart: '2026-04-20', actualEnd: '2026-04-28', progress: 100, owner: '张工' },
      { id: 't2', name: '方案设计', phaseId: 'design',
        planStart: '2026-05-01', planEnd: '2026-05-20',
        actualStart: '2026-05-01', actualEnd: '2026-05-18', progress: 100, owner: '李工' },
      { id: 't3', name: '图纸审核', phaseId: 'design',
        planStart: '2026-05-21', planEnd: '2026-05-31',
        actualStart: '2026-05-21', actualEnd: '2026-05-30', progress: 100, owner: '王工' },
      { id: 't4', name: '设备到货', phaseId: 'construction',
        planStart: '2026-06-01', planEnd: '2026-06-10',
        actualStart: '2026-06-01', actualEnd: '2026-06-09', progress: 100, owner: '陈工' },
      { id: 't5', name: '桥架安装', phaseId: 'construction',
        planStart: '2026-06-11', planEnd: '2026-06-30',
        actualStart: '2026-06-11', progress: 30, owner: '陈工' },
      { id: 't6', name: '线缆敷设', phaseId: 'construction',
        planStart: '2026-07-01', planEnd: '2026-08-05', progress: 0, owner: '陈工' },
      { id: 't7', name: '设备调试', phaseId: 'construction',
        planStart: '2026-08-06', planEnd: '2026-08-20', progress: 0, owner: '陈工' },
      { id: 't8', name: '验收交付', phaseId: 'acceptance',
        planStart: '2026-08-21', planEnd: '2026-09-10', progress: 0, owner: '某某' }
    ],
    files: [
      { id: 'f1', name: '设计文档', type: 'folder' },
      { id: 'f2', name: '机房布线方案 v3.docx', type: 'file', ext: 'docx', parentId: 'f1' },
      { id: 'f3', name: '图纸', type: 'folder' },
      { id: 'f4', name: '机柜布置图.dwg', type: 'file', ext: 'dwg', parentId: 'f3' },
      { id: 'f5', name: '综合布线拓扑图.dwg', type: 'file', ext: 'dwg', parentId: 'f3' },
      { id: 'f6', name: '到货清单', type: 'folder' },
      { id: 'f7', name: '设备到货签收单.xlsx', type: 'file', ext: 'xlsx', parentId: 'f6' }
    ],
    activities: [],
    aiNotes: []
  },

  // -----------------------------------------------------------------
  // 03 / M-2026 某博物馆弱电集成 — 后期·验收 进行中
  // -----------------------------------------------------------------
  {
    id: 'm-2026',
    code: 'M-2026',
    name: '某博物馆弱电集成',
    status: 'active',
    start: '2026-03-15',
    end: '2026-06-30',
    description: '弱电系统集成 · 安防/广播/网络',
    phases: [
      { id: 'design', name: '前期 · 设计', color: '#dbeafe', order: 1,
        planStart: '2026-03-15', planEnd: '2026-04-15',
        actualStart: '2026-03-15', actualEnd: '2026-04-15' },
      { id: 'construction', name: '中期 · 施工', color: '#fef3c7', order: 2,
        planStart: '2026-04-16', planEnd: '2026-06-05',
        actualStart: '2026-04-16', actualEnd: '2026-06-04' },
      { id: 'acceptance', name: '后期 · 调试验收', color: '#d1fae5', order: 3,
        planStart: '2026-06-06', planEnd: '2026-06-30',
        actualStart: '2026-06-06' }
    ],
    milestones: [
      { id: 'm1', name: 'M1 开工', date: '2026-04-15',
        betweenPhases: ['design', 'construction'], status: 'reached' },
      { id: 'm2', name: 'M2 验收交付', date: '2026-06-05',
        betweenPhases: ['construction', 'acceptance'], status: 'pending' }
    ],
    tasks: [
      { id: 't1', name: '需求确认', phaseId: 'design',
        planStart: '2026-03-15', planEnd: '2026-03-25',
        actualStart: '2026-03-15', actualEnd: '2026-03-24', progress: 100, owner: '张工' },
      { id: 't2', name: '方案设计', phaseId: 'design',
        planStart: '2026-03-26', planEnd: '2026-04-10',
        actualStart: '2026-03-26', actualEnd: '2026-04-08', progress: 100, owner: '李工' },
      { id: 't3', name: '图纸审核', phaseId: 'design',
        planStart: '2026-04-11', planEnd: '2026-04-15',
        actualStart: '2026-04-11', actualEnd: '2026-04-15', progress: 100, owner: '王工' },
      { id: 't4', name: '弱电管线', phaseId: 'construction',
        planStart: '2026-04-16', planEnd: '2026-05-05',
        actualStart: '2026-04-16', actualEnd: '2026-05-04', progress: 100, owner: '陈工' },
      { id: 't5', name: '设备安装', phaseId: 'construction',
        planStart: '2026-05-06', planEnd: '2026-05-20',
        actualStart: '2026-05-06', actualEnd: '2026-05-19', progress: 100, owner: '陈工' },
      { id: 't6', name: '系统调试', phaseId: 'construction',
        planStart: '2026-05-21', planEnd: '2026-06-05',
        actualStart: '2026-05-21', actualEnd: '2026-06-04', progress: 100, owner: '陈工' },
      { id: 't7', name: '验收测试', phaseId: 'acceptance',
        planStart: '2026-06-06', planEnd: '2026-06-26',
        actualStart: '2026-06-06', progress: 50, owner: '赵工' },
      { id: 't8', name: '交付培训', phaseId: 'acceptance',
        planStart: '2026-06-27', planEnd: '2026-06-30', progress: 0, owner: '某某' }
    ],
    files: [
      { id: 'f1', name: '设计文档', type: 'folder' },
      { id: 'f2', name: '弱电系统设计方案 v2.docx', type: 'file', ext: 'docx', parentId: 'f1' },
      { id: 'f3', name: '技术规格书.pdf', type: 'file', ext: 'pdf', parentId: 'f1' },
      { id: 'f4', name: '图纸', type: 'folder' },
      { id: 'f5', name: '弱电井道图.dwg', type: 'file', ext: 'dwg', parentId: 'f4' },
      { id: 'f6', name: '平面布置图.dwg', type: 'file', ext: 'dwg', parentId: 'f4' },
      { id: 'f7', name: '系统拓扑图.dwg', type: 'file', ext: 'dwg', parentId: 'f4' },
      { id: 'f8', name: '合同', type: 'folder' },
      { id: 'f9', name: '主合同.pdf', type: 'file', ext: 'pdf', parentId: 'f8' },
      { id: 'f10', name: '验收', type: 'folder' },
      { id: 'f11', name: '验收标准.docx', type: 'file', ext: 'docx', parentId: 'f10' },
      { id: 'f12', name: '测试报告.pdf', type: 'file', ext: 'pdf', parentId: 'f10' }
    ],
    activities: [],
    aiNotes: []
  }
];

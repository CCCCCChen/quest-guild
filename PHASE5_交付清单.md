# Phase 5.5 / 5.6 本地快赢交付清单（纯 DB 种子）

> 日期：2026-08-18 · 对应路线图 §5 + 决策 3（AI 桥接）

## 备份
- `server/backups/2026-08-18-phase5/quest-guild.db`（连同 `-wal`/`-shm`）。执行前已备份，可回滚。

## 本次落库内容（事务内，已校验）
| 项 | 结果 | 说明 |
|----|------|------|
| 健康与体能分支 | +12 节点 | 1 域 `cap-health`(unlocked) + 5 二级(locked) + 6 三级叶(locked)，坐标预计算 |
| AI 桥接 | 仅解锁 `cap-creation-ai-basic` | **父节点 `cap-creation-ai` 保持 locked**（按用户决策，§3 原文解锁两个已偏离） |
| 清垃圾项目 | 删 1 条 | `name='123' AND goalId IS NULL` |
| 目标里程碑 | 7 条 goals 写入 | 新增列 `milestone` + `milestoneDeadline`(=2026-11-16 23:59 +08)，含可验证标准 |
| 项目种子 | +7 个 projects | 每目标 1 个承接项目，`capabilityIds` 经校验全部解析正常（无悬空） |

## 核验结果
- skills 总数 **87**（75+12）✅
- health 节点 **12** ✅；AI basic=unlocked、AI 父=locked ✅
- projects **7**、junk=0 ✅
- 7 目标 milestone 全部写入、deadline 一致 ✅
- 每个 goal ↔ 1 project 链接 ✅

## 安全性确认
- `/api/bootstrap`（server/index.js:943）仅在 `skillCount===0` 时写 skills；当前库 87 条，**重启不会覆盖**本次种子。
- goals/projects **不在** bootstrap 范围，不会被触碰。
- 本次用 Python 标准库 `sqlite3` 执行，规避 Node `better-sqlite3` 原生模块 ABI 风险。

## 刻意未做（划界，避免打断应用）
1. **主链修复前端部分**：目标页汇总 + 逾期红字高亮、项目进度由子任务自动汇总、新建任务 `goalId/projectId` 必填其一——均属 Phase 5.6 前端 + 后端联动。
   - ⚠️ **勿单独加后端 400 守卫**：当前前端创建任务不传 linkage 字段，加了会让 UI 创建任务直接报错。须等前端表单支持 linkage 时一并上。
2. **13 个历史游离任务**未自动关联 goal/project（需人工判断归属，不应猜测）。
3. **全新安装**不自动含健康分支：当前种子只写入现有库；若未来需全新安装也含，须同步更新前端 skills 预设（bootstrap 不读 `src/data/preset.ts`）。

## 下一步
- Phase 1（streak 移植 + 完成庆祝）——最高杠杆，建议接着做。
- 或补 Phase 5.6 前端（需先改前端任务表单支持 linkage，再上后端必填校验）。

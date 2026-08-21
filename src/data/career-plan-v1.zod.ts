// EXPORTS: careerPlanV1Schema, capabilityNodeSchema, goalSchema, projectSchema, epicSchema,
//           type CareerPlanV1, type CapabilityNode, type GoalSpec, type ProjectSpec, type EpicSpec
//
// P0-5 · 专家导入/导出格式 `quest-guild-career-plan-v1.json` 的 Zod 单一可信源。
// - 运行时（Phase 2/3 导入 UI）用 safeParse 拿到精确 path（如 ['goals', 2, 'deadline']）做报错定位；
// - 构建期由 scripts/export-career-schema.mjs 用 z.toJSONSchema 导出 public/schemas/career-plan-v1.schema.json，
//   作为外部校验器与专家交付模板依据。
import { z } from 'zod';

// ---------- 能力树（支持嵌套 children，导入时由映射面板拍平）----------
export const capabilityNodeSchema: z.ZodType<CapabilityNode> = z.lazy(() =>
  z.object({
    externalId: z.string().min(1, 'externalId 必填'),
    name: z.string().min(1, 'name 必填'),
    category: z.string().min(1, 'category 必填（用于能力树画布分组）'),
    parentId: z.string().nullable().optional().describe('null=一级；或 cap-*/本 items 内另一条 externalId'),
    description: z.string().default(''),
    level: z.number().int().min(1).max(3).describe('1=一级域, 2=二级子域, 3=三级叶'),
    requiredSkillPoints: z.number().int().min(0),
    x: z.number().optional().describe('画布坐标，可缺省（系统自动布局）'),
    y: z.number().optional(),
    children: z.array(capabilityNodeSchema).optional(),
  })
);

export interface CapabilityNode {
  externalId: string;
  name: string;
  category: string;
  parentId?: string | null;
  description?: string;
  level: number;
  requiredSkillPoints: number;
  x?: number;
  y?: number;
  children?: CapabilityNode[];
}

// ---------- 目标 ----------
export const milestoneSchema = z.object({
  name: z.string().min(1, 'milestone.name 必填'),
  deadline: z.string().optional().describe('ISO 日期，如 2026-11-16'),
  verification: z.string().optional().describe('验收标准'),
});
export type MilestoneSpec = z.infer<typeof milestoneSchema>;

export const goalSchema = z.object({
  externalId: z.string().min(1, 'goal.externalId 必填'),
  name: z.string().min(1, 'goal.name 必填'),
  description: z.string().default(''),
  deadline: z.string().optional().describe('ISO 日期，如 2031-01-01'),
  weight: z.number().int().min(1).max(100).optional().describe('目标权重 1-100，供排序引擎'),
  status: z.enum(['active', 'archived']).default('active'),
  milestones: z.array(milestoneSchema).optional(),
});
export type GoalSpec = z.infer<typeof goalSchema>;

// ---------- 项目 ----------
export const projectSchema = z.object({
  externalId: z.string().min(1, 'project.externalId 必填'),
  goalExternalId: z.string().min(1, 'project.goalExternalId 必填（挂到 goals 数组里的一条）'),
  milestoneIndex: z.number().int().min(0).optional().describe('可选，承接第 N 个里程碑'),
  name: z.string().min(1, 'project.name 必填'),
  description: z.string().default(''),
  capabilityExternalIds: z.array(z.string()).optional(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
});
export type ProjectSpec = z.infer<typeof projectSchema>;

// ---------- 史诗（远征）----------
export const epicSchema = z.object({
  externalId: z.string().min(1, 'epic.externalId 必填'),
  projectExternalId: z.string().min(1, 'epic.projectExternalId 必填（挂到 projects 数组里的一条）'),
  name: z.string().min(1, 'epic.name 必填'),
  description: z.string().default(''),
  difficulty: z.enum(['easy', 'normal', 'hard', 'epic']).optional(),
  estimatedMinutes: z.number().int().min(1).optional(),
  bossName: z.string().optional().describe('未填系统自动生成'),
  stages: z.array(z.array(z.string())).optional().describe('二维数组：外层=阶段，内层=该阶段子任务名'),
});
export type EpicSpec = z.infer<typeof epicSchema>;

// ---------- 顶层文档 ----------
export const careerPlanV1Schema = z
  .object({
    schemaVersion: z.string().min(1).describe('格式版本，如 "1.0"'),
    generator: z.string().optional(),
    generatedAt: z.string().optional().describe('ISO 时间'),
    meta: z
      .object({
        clientName: z.string().optional(),
        consultationDate: z.string().optional(),
        sourceExportVersion: z.string().optional(),
      })
      .optional(),
    capabilities: z.object({
      action: z.enum(['merge', 'replace']).describe('merge=增量追加（推荐）；replace=整棵能力树替换（危险）'),
      items: z.array(capabilityNodeSchema).min(1, 'capabilities.items 至少 1 条'),
    }),
    goals: z.array(goalSchema).min(1, 'goals 至少 1 条'),
    projects: z.array(projectSchema),
    epics: z.array(epicSchema),
  })
  .superRefine((doc, ctx) => {
    // 跨引用完整性：project.goalExternalId → goals；epic.projectExternalId → projects
    const goalIds = new Set(doc.goals.map((g) => g.externalId));
    const projectIds = new Set(doc.projects.map((p) => p.externalId));

    doc.projects.forEach((p, i) => {
      if (!goalIds.has(p.goalExternalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['projects', i, 'goalExternalId'],
          message: `找不到对应的 goal.externalId：「${p.goalExternalId}」`,
        });
      }
    });

    doc.epics.forEach((e, i) => {
      if (!projectIds.has(e.projectExternalId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['epics', i, 'projectExternalId'],
          message: `找不到对应的 project.externalId：「${e.projectExternalId}」`,
        });
      }
    });
  });

export type CareerPlanV1 = z.infer<typeof careerPlanV1Schema>;

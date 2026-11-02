import { useMemo, useState } from 'react';
import { Plus, Flag, Edit2, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useGoals } from '@/hooks/useGoals';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import type { IGoal } from '@/types/quest';

const formSchema = z.object({
  name: z.string().min(1, '请输入目标名称').max(50, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  deadline: z.string().optional(),
  milestone: z.string().max(200, '里程碑过长').optional(),
  milestoneDeadline: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal } = useGoals();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IGoal | null>(null);
  const [deleting, setDeleting] = useState<IGoal | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      deadline: '',
      milestone: '',
      milestoneDeadline: '',
    },
  });

  const orderedGoals = useMemo(() => {
    return [...goals].sort((a, b) => b.createdAt - a.createdAt);
  }, [goals]);

  // 项目按目标分组
  const projectIdsByGoal = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of projects) {
      if (!p.goalId) continue;
      if (!m.has(p.goalId)) m.set(p.goalId, []);
      m.get(p.goalId)!.push(p.id);
    }
    return m;
  }, [projects]);

  // 任务按项目分组
  const tasksByProject = useMemo(() => {
    const m = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (!t.projectId) continue;
      if (!m.has(t.projectId)) m.set(t.projectId, []);
      m.get(t.projectId)!.push(t);
    }
    return m;
  }, [tasks]);

  // 目标聚合统计：项目数 + 任务完成进度
  const goalStats = useMemo(() => {
    const m = new Map<string, { projectCount: number; taskTotal: number; taskDone: number }>();
    for (const g of goals) {
      const pids = projectIdsByGoal.get(g.id) || [];
      let taskTotal = 0;
      let taskDone = 0;
      for (const pid of pids) {
        const list = tasksByProject.get(pid) || [];
        taskTotal += list.length;
        taskDone += list.filter((t) => t.status === 'completed').length;
      }
      m.set(g.id, { projectCount: pids.length, taskTotal, taskDone });
    }
    return m;
  }, [goals, projectIdsByGoal, tasksByProject]);

  const now = Date.now();
  function isOverdue(ts?: number) {
    return !!ts && ts < now;
  }

  // P2-C3：里程碑截止状态（逾期 / 临近 3 天 / 正常），用于高亮
  type MilestoneStatus = 'overdue' | 'near' | 'normal';
  function milestoneStatus(ts?: number): MilestoneStatus {
    if (!ts) return 'normal';
    const daysLeft = (ts - now) / 86400000;
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 3) return 'near';
    return 'normal';
  }

  function resetForm(nextEditing: IGoal | null) {
    setEditing(nextEditing);
    form.reset({
      name: nextEditing?.name ?? '',
      description: nextEditing?.description ?? '',
      deadline: formatDate(nextEditing?.deadline),
      milestone: nextEditing?.milestone ?? '',
      milestoneDeadline: formatDate(nextEditing?.milestoneDeadline),
    });
  }

  async function onSubmit(values: FormValues) {
    const deadline = values.deadline ? new Date(values.deadline).getTime() : undefined;
    const milestoneDeadline = values.milestoneDeadline
      ? new Date(values.milestoneDeadline).getTime()
      : undefined;
    if (editing) {
      await updateGoal(editing.id, {
        name: values.name,
        description: values.description || '',
        deadline,
        milestone: values.milestone || undefined,
        milestoneDeadline,
      });
    } else {
      await addGoal({
        name: values.name,
        description: values.description || '',
        deadline,
        milestone: values.milestone || undefined,
        milestoneDeadline,
      });
    }
    setOpen(false);
    resetForm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Flag className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">目标</div>
            <div className="text-sm text-muted-foreground">用更少的目标，统领更多的项目与任务</div>
          </div>
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => resetForm(null)}>
              <Plus className="size-4 mr-2" />
              新增目标
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? '编辑目标' : '新增目标'}</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：打造个人成长系统" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>描述</FormLabel>
                      <FormControl>
                        <MarkdownEditor value={field.value} onChange={field.onChange} placeholder="为什么重要？成功标准是什么？" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>截止日期</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="milestone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>里程碑</FormLabel>
                      <FormControl>
                        <Input placeholder="例如：完成数据底座 v1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="milestoneDeadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>里程碑截止</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit">{editing ? '保存' : '创建'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {orderedGoals.map((goal) => (
          <Card key={goal.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">{goal.name}</CardTitle>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant={goal.status === 'archived' ? 'secondary' : 'default'}>
                      {goal.status === 'archived' ? '已归档' : '进行中'}
                    </Badge>
                    {goal.deadline ? (
                      <Badge variant={isOverdue(goal.deadline) ? 'destructive' : 'outline'}>
                        {isOverdue(goal.deadline) ? '已逾期 ' : '截止 '}
                        {formatDate(goal.deadline)}
                      </Badge>
                    ) : null}
                    {goal.milestone ? (
                      <Badge
                        variant="outline"
                        className={
                          milestoneStatus(goal.milestoneDeadline) === 'overdue'
                            ? 'border-destructive/50 text-destructive'
                            : milestoneStatus(goal.milestoneDeadline) === 'near'
                              ? 'border-warning/50 text-warning'
                              : 'border-primary/40 text-primary'
                        }
                      >
                        {milestoneStatus(goal.milestoneDeadline) === 'overdue' ? '⚠ 已逾期 ' : '🏁 '}
                        {goal.milestone}
                        {goal.milestoneDeadline ? `（${formatDate(goal.milestoneDeadline)}）` : ''}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(true);
                      resetForm(goal);
                    }}
                  >
                    <Edit2 className="size-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleting(goal)}
                  >
                    <Trash2 className="size-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {goal.description ? <MarkdownRenderer content={goal.description} /> : '（暂无描述）'}
              </div>

              {/* 目标汇总：项目数 + 任务完成进度 */}
              {(() => {
                const stat = goalStats.get(goal.id);
                if (!stat) return null;
                const pct = stat.taskTotal === 0 ? 0 : Math.round((stat.taskDone / stat.taskTotal) * 100);
                return (
                  <div className="space-y-1 rounded-md border border-border/50 bg-secondary/30 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        项目 {stat.projectCount} · 任务 {stat.taskDone}/{stat.taskTotal}
                      </span>
                      <span className="tabular-nums">{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        ))}

        {orderedGoals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              还没有目标，先创建一个 “北极星”。
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除目标？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后无法恢复。目标下关联的项目/任务暂不会自动处理，需要你手动调整关联关系。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteGoal(deleting.id);
                setDeleting(null);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


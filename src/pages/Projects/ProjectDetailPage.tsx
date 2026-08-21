import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, Plus, Swords, Target, Zap } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';
import { useGoals } from '@/hooks/useGoals';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useShop } from '@/hooks/useShop';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { inheritContext } from '@/lib/contextInherit';
import type { IQuestTask } from '@/types/quest';

const taskFormSchema = z.object({
  name: z.string().min(1, '请输入任务名称').max(50, '名称过长'),
  estimatedMinutes: z.number().int().min(5, '至少 5 分钟').max(9999, '数值过大'),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export default function ProjectDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const {
    tasks,
    addTask,
    setTrackingTask,
    addAttentionTask,
    completeTask,
    trackingTask,
    activeAttentionTasks,
  } = useTasks();
  const { addReputation } = useShop();
  const { settings } = useSettings();

  const [createOpen, setCreateOpen] = useState(false);
  const project = useMemo(() => projects.find((p) => p.id === id) || null, [projects, id]);
  const goalNameMap = useMemo(() => new Map(goals.map((g) => [g.id, g.name])), [goals]);

  const projectTasks = useMemo(() => {
    if (!id) return [];
    return tasks.filter((t) => t.projectId === id);
  }, [tasks, id]);

  const { totalCount, completedCount, activeCount, pendingCount, progress } = useMemo(() => {
    const total = projectTasks.length;
    const completed = projectTasks.filter((t) => t.status === 'completed').length;
    const active = projectTasks.filter((t) => t.status === 'active').length;
    const pending = projectTasks.filter((t) => t.status === 'pending').length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { totalCount: total, completedCount: completed, activeCount: active, pendingCount: pending, progress: pct };
  }, [projectTasks]);

  const orderedTasks = useMemo(() => {
    return [...projectTasks].sort((a, b) => {
      const w = (s: IQuestTask['status']) => (s === 'active' ? 0 : s === 'pending' ? 1 : 2);
      const sw = w(a.status) - w(b.status);
      if (sw !== 0) return sw;
      return b.createdAt - a.createdAt;
    });
  }, [projectTasks]);

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: { name: '', estimatedMinutes: 30 },
  });

  function openCreate() {
    taskForm.reset({ name: '', estimatedMinutes: 30 });
    setCreateOpen(true);
  }

  function submitProjectTask(values: TaskFormValues) {
    if (!project) return;
    // 继承项目上下文（goalId / projectId / capabilityIds），保证任务归属链路不断
    const ctx = inheritContext(project, {
      projectId: project.id,
      goalId: project.goalId,
      capabilityIds: project.capabilityIds,
    });
    addTask({
      name: values.name,
      description: '',
      type: 'daily',
      difficulty: 'normal',
      estimatedMinutes: values.estimatedMinutes,
      ...ctx,
      tags: ctx.tags ?? [],
    });
    toast.success('项目任务已创建');
    setCreateOpen(false);
  }

  function addFocus(taskId: string) {
    if (activeAttentionTasks.length >= settings.manaMax) {
      toast.error('专注槽已满', { description: '请先完成其他注意力任务' });
      return;
    }
    const ok = addAttentionTask(taskId, settings.manaMax);
    if (!ok) return;
  }

  function handleComplete(task: IQuestTask) {
    completeTask(task.id);
    addReputation(task.rewardReputation);
    toast.success(`任务完成！获得 ${task.rewardReputation} 声望`, { description: task.name });
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/projects')} className="gap-2">
          <ArrowLeft className="size-4" />
          返回项目列表
        </Button>
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">项目不存在或已被删除</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/projects')} className="gap-2 w-fit">
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="space-y-1">
            <div className="text-2xl font-bold">{project.name}</div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={project.status === 'archived' ? 'secondary' : 'default'}>
                {project.status === 'archived' ? '已归档' : project.status === 'completed' ? '已完成' : '进行中'}
              </Badge>
              {project.goalId ? (
                <Badge variant="outline">目标：{goalNameMap.get(project.goalId) || project.goalId}</Badge>
              ) : null}
              <Badge variant="outline">{totalCount} 个任务</Badge>
              <Badge variant="outline">{completedCount} 完成</Badge>
              <Badge variant="outline">{activeCount} 进行中</Badge>
              <Badge variant="outline">{pendingCount} 待开始</Badge>
            </div>
          </div>
          <div className="max-w-xl text-sm text-muted-foreground">
            {project.description ? <MarkdownRenderer content={project.description} /> : '（暂无描述）'}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate(`/quest-pool?projectId=${encodeURIComponent(project.id)}`)}>
            <Swords className="size-4 mr-2" />
            在悬赏池查看
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4 mr-2" />
                创建任务
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>为项目创建任务</DialogTitle>
              </DialogHeader>
              <Form {...taskForm}>
                <form onSubmit={taskForm.handleSubmit(submitProjectTask)} className="space-y-4">
                  <FormField
                    control={taskForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>任务名称</FormLabel>
                        <FormControl>
                          <Input placeholder="例如：把 Project 详情联动到任务" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={taskForm.control}
                    name="estimatedMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>预估用时（分钟）</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={5}
                            value={field.value}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            onBlur={field.onBlur}
                            name={field.name}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit">创建任务</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span>项目进度</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress value={progress} />
          <div className="text-xs text-muted-foreground">
            进度按任务完成情况自动计算（完成/总数）
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">项目任务</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orderedTasks.length === 0 ? (
            <div className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center">
              还没有项目任务，从右上角创建一条开始推进。
            </div>
          ) : (
            <div className="space-y-2">
              {orderedTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-md border border-border/50 px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{task.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" />
                        {task.estimatedMinutes} 分钟
                      </span>
                      {task.isTracking ? <Badge variant="outline">追踪中</Badge> : null}
                      {task.isAttention ? <Badge variant="outline">注意力</Badge> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={task.status === 'completed' ? 'secondary' : 'outline'}
                      className={cn(task.status === 'active' ? 'border-primary/30 text-primary' : '')}
                    >
                      {task.status === 'completed' ? '已完成' : task.status === 'active' ? '进行中' : '待开始'}
                    </Badge>
                    {task.status !== 'completed' ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setTrackingTask(task.id)}
                          className="gap-1"
                        >
                          <Target className="size-4" />
                          追踪
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addFocus(task.id)}
                          className="gap-1"
                        >
                          <Zap className="size-4" />
                          注意力
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleComplete(task)}
                          className="gap-1 border-success/40 text-success hover:bg-success/10 hover:text-success"
                        >
                          完成
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {trackingTask && trackingTask.projectId === project.id ? (
            <div className="text-xs text-muted-foreground">当前追踪任务属于该项目</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}


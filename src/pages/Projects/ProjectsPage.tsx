import { useMemo, useState } from 'react';
import { FolderKanban, Plus, Edit2, Trash2, Target, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useGoals } from '@/hooks/useGoals';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import type { IProject } from '@/types/quest';

const formSchema = z.object({
  name: z.string().min(1, '请输入项目名称').max(50, '名称过长'),
  description: z.string().max(500, '描述过长').optional(),
  goalId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const taskFormSchema = z.object({
  name: z.string().min(1, '请输入任务名称').max(50, '名称过长'),
  estimatedMinutes: z.number().int().min(5, '至少 5 分钟').max(9999, '数值过大'),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { goals } = useGoals();
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { tasks, addTask } = useTasks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IProject | null>(null);
  const [deleting, setDeleting] = useState<IProject | null>(null);
  const [taskDialogProject, setTaskDialogProject] = useState<IProject | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      goalId: '',
    },
  });

  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: '',
      estimatedMinutes: 30,
    },
  });

  const goalNameMap = useMemo(() => {
    return new Map(goals.map((g) => [g.id, g.name]));
  }, [goals]);

  const orderedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.createdAt - a.createdAt);
  }, [projects]);

  const tasksByProject = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const task of tasks) {
      if (!task.projectId) continue;
      if (!map.has(task.projectId)) map.set(task.projectId, []);
      map.get(task.projectId)!.push(task);
    }
    return map;
  }, [tasks]);

  // 每个项目的完成进度（优先按子任务计算，无子任务时回退到项目自带 progress）
  const projectProgress = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) {
      const list = tasksByProject.get(p.id) || [];
      const total = list.length;
      const completed = list.filter((t) => t.status === 'completed').length;
      m.set(p.id, total === 0 ? p.progress : Math.round((completed / total) * 100));
    }
    return m;
  }, [projects, tasksByProject]);

  function resetForm(nextEditing: IProject | null) {
    setEditing(nextEditing);
    form.reset({
      name: nextEditing?.name ?? '',
      description: nextEditing?.description ?? '',
      goalId: nextEditing?.goalId ?? '',
    });
  }

  async function onSubmit(values: FormValues) {
    if (editing) {
      await updateProject(editing.id, {
        name: values.name,
        description: values.description || '',
        goalId: values.goalId || undefined,
      });
    } else {
      await addProject({
        name: values.name,
        description: values.description || '',
        goalId: values.goalId || undefined,
      });
    }
    setOpen(false);
    resetForm(null);
  }

  function openTaskDialog(project: IProject) {
    setTaskDialogProject(project);
    taskForm.reset({
      name: '',
      estimatedMinutes: 30,
    });
  }

  function submitProjectTask(values: TaskFormValues) {
    if (!taskDialogProject) return;
    addTask({
      name: values.name,
      description: '',
      type: 'daily',
      difficulty: 'normal',
      estimatedMinutes: values.estimatedMinutes,
      goalId: taskDialogProject.goalId,
      projectId: taskDialogProject.id,
      capabilityIds: taskDialogProject.capabilityIds,
      tags: [],
    });
    toast.success('项目任务已创建');
    setTaskDialogProject(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
            <FolderKanban className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">项目</div>
            <div className="text-sm text-muted-foreground">把目标拆成可推进的成长项目</div>
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
              新增项目
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? '编辑项目' : '新增项目'}</DialogTitle>
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
                        <Input placeholder="例如：Quest Guild 2.0 数据底座" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="goalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>关联目标</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="可选" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">不关联</SelectItem>
                          {goals.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <MarkdownEditor value={field.value} onChange={field.onChange} placeholder="范围、里程碑、验收标准" />
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
        {orderedProjects.map((project) => (
          <Card key={project.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle
                    className="text-lg truncate hover:text-primary cursor-pointer flex items-center gap-2"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <span className="truncate">{project.name}</span>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </CardTitle>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant={project.status === 'archived' ? 'secondary' : 'default'}>
                      {project.status === 'archived' ? '已归档' : project.status === 'completed' ? '已完成' : '进行中'}
                    </Badge>
                    {project.goalId ? (
                      <Badge variant="outline">目标：{goalNameMap.get(project.goalId) || project.goalId}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    查看详情
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openTaskDialog(project)}
                  >
                    <Plus className="size-4 mr-1" />
                    新建任务
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(true);
                      resetForm(project);
                    }}
                  >
                    <Edit2 className="size-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleting(project)}
                  >
                    <Trash2 className="size-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {project.description ? <MarkdownRenderer content={project.description} /> : '（暂无描述）'}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>进度</span>
                  <span>{projectProgress.get(project.id) ?? project.progress}%</span>
                </div>
                <Progress value={projectProgress.get(project.id) ?? project.progress} />
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Target className="size-4 text-primary" />
                  项目任务
                </div>
                {(tasksByProject.get(project.id) || []).length > 0 ? (
                  <div className="space-y-2">
                    {(tasksByProject.get(project.id) || []).slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{task.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="size-3" />
                            {task.estimatedMinutes} 分钟
                          </div>
                        </div>
                        <Badge variant={task.status === 'completed' ? 'secondary' : 'outline'}>
                          {task.status === 'completed' ? '已完成' : task.status === 'active' ? '进行中' : '待开始'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-4">
                    还没有关联任务，可以从这里直接补一条。
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {orderedProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              还没有项目，建议从你当前最想推进的一件事开始。
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除项目？</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteProject(deleting.id);
                setDeleting(null);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!taskDialogProject} onOpenChange={(v) => !v && setTaskDialogProject(null)}>
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
                      <Input placeholder="例如：拆出项目 API 与页面联动" {...field} />
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
  );
}

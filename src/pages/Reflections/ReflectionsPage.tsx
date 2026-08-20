import { useMemo, useState } from 'react';
import { NotebookPen, Plus, Edit2, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/utils';
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
import { useTasks } from '@/hooks/useTasks';
import { useReflections } from '@/hooks/useReflections';
import type { IReflection } from '@/types/quest';

const formSchema = z.object({
  taskId: z.string().min(1, '请选择任务'),
  expectedResult: z.string().max(500, '内容过长').optional(),
  actualResult: z.string().max(500, '内容过长').optional(),
  lessonLearned: z.string().max(500, '内容过长').optional(),
  nextAction: z.string().max(500, '内容过长').optional(),
});

type FormValues = z.infer<typeof formSchema>;


export default function ReflectionsPage() {
  const { tasks } = useTasks();
  const { reflections, addReflection, updateReflection, deleteReflection } = useReflections();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IReflection | null>(null);
  const [deleting, setDeleting] = useState<IReflection | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taskId: '',
      expectedResult: '',
      actualResult: '',
      lessonLearned: '',
      nextAction: '',
    },
  });

  const taskNameMap = useMemo(() => {
    return new Map(tasks.map((t) => [t.id, t.name]));
  }, [tasks]);

  const ordered = useMemo(() => {
    return [...reflections].sort((a, b) => b.createdAt - a.createdAt);
  }, [reflections]);

  function resetForm(nextEditing: IReflection | null) {
    setEditing(nextEditing);
    form.reset({
      taskId: nextEditing?.taskId ?? '',
      expectedResult: nextEditing?.expectedResult ?? '',
      actualResult: nextEditing?.actualResult ?? '',
      lessonLearned: nextEditing?.lessonLearned ?? '',
      nextAction: nextEditing?.nextAction ?? '',
    });
  }

  async function onSubmit(values: FormValues) {
    if (editing) {
      await updateReflection(editing.id, {
        taskId: values.taskId,
        expectedResult: values.expectedResult || '',
        actualResult: values.actualResult || '',
        lessonLearned: values.lessonLearned || '',
        nextAction: values.nextAction || '',
      });
    } else {
      await addReflection({
        taskId: values.taskId,
        expectedResult: values.expectedResult || '',
        actualResult: values.actualResult || '',
        lessonLearned: values.lessonLearned || '',
        nextAction: values.nextAction || '',
      });
    }
    setOpen(false);
    resetForm(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-info/15 text-info flex items-center justify-center">
            <NotebookPen className="size-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">复盘</div>
            <div className="text-sm text-muted-foreground">把经验固化为下一步行动</div>
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
              新增复盘
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? '编辑复盘' : '新增复盘'}</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="taskId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>关联任务</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择一个任务" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {tasks.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
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
                  name="expectedResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>预期结果</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualResult"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>实际结果</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lessonLearned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>经验教训</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-16" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nextAction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>下一步行动</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-16" {...field} />
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
        {ordered.map((r) => (
          <Card key={r.id} className="border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">
                    {taskNameMap.get(r.taskId) || r.taskId}
                  </CardTitle>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{formatDateTime(r.createdAt)}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(true);
                      resetForm(r);
                    }}
                  >
                    <Edit2 className="size-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleting(r)}
                  >
                    <Trash2 className="size-4 mr-1" />
                    删除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="space-y-1">
                <div className="text-muted-foreground">预期结果</div>
                <div className="whitespace-pre-wrap">{r.expectedResult || '（未填写）'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">实际结果</div>
                <div className="whitespace-pre-wrap">{r.actualResult || '（未填写）'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">经验教训</div>
                <div className="whitespace-pre-wrap">{r.lessonLearned || '（未填写）'}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">下一步行动</div>
                <div className="whitespace-pre-wrap">{r.nextAction || '（未填写）'}</div>
              </div>
            </CardContent>
          </Card>
        ))}

        {ordered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">
              还没有复盘。完成一个任务后，写下 “下一步行动” 会非常有收益。
            </CardContent>
          </Card>
        ) : null}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除复盘？</AlertDialogTitle>
            <AlertDialogDescription>删除后无法恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteReflection(deleting.id);
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


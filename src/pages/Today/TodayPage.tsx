import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  Swords,
  Sparkles,
  Plus,
  Clock,
  Target,
  Check,
  Zap,
  Trophy,
  X,
  ChevronRight,
  AlertTriangle,
  ArrowLeftCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useTasks } from '@/hooks/useTasks';
import { useGoals } from '@/hooks/useGoals';
import { useProjects } from '@/hooks/useProjects';
import { useShop } from '@/hooks/useShop';
import { useSettings } from '@/hooks/useSettings';
import { TimeAccountPanel } from '@/components/TimeAccountPanel';
import { computeTimeAccount, formatMinutes } from '@/lib/timeAccount';
import { formatDuration, cn } from '@/lib/utils';
import { computeGoalProgress } from '@/lib/progress';
import type { IQuestTask, TaskDifficulty, ExecutionContext } from '@/types/quest';

const DIFFICULTY_LABEL: Record<TaskDifficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  epic: '史诗',
};

const DIFFICULTY_COLOR: Record<TaskDifficulty, string> = {
  easy: 'bg-success/20 text-success border-success/40',
  normal: 'bg-info/20 text-info border-info/40',
  hard: 'bg-warning/20 text-warning border-warning/40',
  epic: 'bg-accent/20 text-accent border-accent/40',
};

// P1-B：执行情境筛选标签
const CONTEXT_LABELS: Record<ExecutionContext, string> = {
  commute: '通勤',
  snippet: '碎片',
  focus: '专注',
  lowEnergy: '低精力',
};

export default function TodayPage() {
  const navigate = useNavigate();
  const {
    tasks,
    trackingTask,
    activeAttentionTasks,
    activeTrack,
    currentTrackSeconds,
    startTracking,
    pauseTracking,
    completeTask,
    addTask,
    setTrackingTask,
    addAttentionTask,
    removeAttentionTask,
  } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { addReputation } = useShop();
  const { settings } = useSettings();

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickMinutes, setQuickMinutes] = useState('30');
  const [quickDifficulty, setQuickDifficulty] = useState<TaskDifficulty>('normal');
  const [quickType, setQuickType] = useState<'daily' | 'epic'>('daily');
  const [confirmCompleteTask, setConfirmCompleteTask] = useState<IQuestTask | null>(null);

  // P1-B：执行情境筛选（多选 OR）
  const [activeContexts, setActiveContexts] = useState<ExecutionContext[]>([]);
  const toggleContext = (c: ExecutionContext) =>
    setActiveContexts((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const isTrackingRunning = activeTrack?.isRunning ?? false;

  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === 'pending' && !t.parentId),
    [tasks]
  );

  // P1-B：按所选执行情境过滤（未标注情境的任务在筛选时隐藏）
  const filteredPendingTasks = useMemo(() => {
    if (activeContexts.length === 0) return pendingTasks;
    return pendingTasks.filter((t) =>
      (t.executionContext ?? []).some((c) => activeContexts.includes(c))
    );
  }, [pendingTasks, activeContexts]);

  const goalNameMap = useMemo(() => new Map(goals.map((g) => [g.id, g.name])), [goals]);
  const projectNameMap = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);

  // P2-C1：DDL 倒排每日所需（基于时间账纯函数）
  const ddlReverse = useMemo(() => computeTimeAccount(tasks).ddlReverse, [tasks]);

  // Phase 1.3：计算任务所属目标的「进度落后程度」权重，作为推荐排序因子
  // 落后度 = max(0, 期望进度 - 实际进度)，乘 100 化成百分点 scale。
  const getGoalLagWeight = useCallback(
    (task: IQuestTask): number => {
      if (!task.goalId) return 0;
      const goal = goals.find((g) => g.id === task.goalId);
      if (!goal || !goal.deadline || goal.deadline <= goal.createdAt) return 0;
      const now = Date.now();
      const total = goal.deadline - goal.createdAt;
      const elapsed = Math.max(0, Math.min(total, now - goal.createdAt));
      const expectedProgress = elapsed / total; // 0~1
      const actualProgress = computeGoalProgress(tasks, projects, goal.id); // 0~1
      return Math.max(0, expectedProgress - actualProgress);
    },
    [goals, tasks, projects],
  );

  const highestValueTask = useMemo(() => {
    return [...filteredPendingTasks].sort((a, b) => {
      const lagA = getGoalLagWeight(a);
      const lagB = getGoalLagWeight(b);
      const aScore = a.rewardReputation + a.rewardSkillPoints * 20 + lagA * 150;
      const bScore = b.rewardReputation + b.rewardSkillPoints * 20 + lagB * 150;
      return bScore - aScore;
    })[0];
  }, [filteredPendingTasks, getGoalLagWeight]);

  const biggestGrowthTask = useMemo(() => {
    return [...filteredPendingTasks].sort((a, b) => {
      const lagA = getGoalLagWeight(a);
      const lagB = getGoalLagWeight(b);
      const aScore =
        (a.capabilityIds?.length || 0) * 30 +
        (a.relatedSkillId ? 20 : 0) +
        a.estimatedMinutes +
        a.rewardSkillPoints * 50 +
        lagA * 120;
      const bScore =
        (b.capabilityIds?.length || 0) * 30 +
        (b.relatedSkillId ? 20 : 0) +
        b.estimatedMinutes +
        b.rewardSkillPoints * 50 +
        lagB * 120;
      return bScore - aScore;
    })[0];
  }, [filteredPendingTasks, getGoalLagWeight]);

  // Phase 1.3：法力水晶满槽软提示 + 一键移回最老注意力任务
  const oldestAttentionTask = useMemo(() => {
    if (activeAttentionTasks.length === 0) return null;
    return [...activeAttentionTasks].sort((a, b) => a.createdAt - b.createdAt)[0];
  }, [activeAttentionTasks]);

  const handleMoveBackOldestAttention = useCallback(() => {
    if (!oldestAttentionTask) return;
    removeAttentionTask(oldestAttentionTask.id);
    toast.success('已移回悬赏池', {
      description: `「${oldestAttentionTask.name}」已从注意力任务移除`,
    });
  }, [oldestAttentionTask, removeAttentionTask]);

  const handleComplete = (task: IQuestTask) => {
    completeTask(task.id);
    addReputation(task.rewardReputation);
    toast.success(`任务完成！获得 ${task.rewardReputation} 声望`, {
      description: task.name,
      icon: <Trophy className="h-4 w-4 text-primary" />,
    });
  };

  const requestComplete = (task: IQuestTask) => {
    setConfirmCompleteTask(task);
  };

  const confirmComplete = () => {
    if (confirmCompleteTask) {
      handleComplete(confirmCompleteTask);
      setConfirmCompleteTask(null);
    }
  };

  const handleQuickSubmit = () => {
    if (!quickName.trim()) return;
    const mins = parseInt(quickMinutes, 10) || 30;
    const rep = Math.max(10, Math.round(mins * (quickDifficulty === 'easy' ? 0.5 : quickDifficulty === 'normal' ? 1 : quickDifficulty === 'hard' ? 2 : 3)));
    const newTask = addTask({
      name: quickName.trim(),
      description: '',
      type: quickType,
      difficulty: quickDifficulty,
      importance: 'medium',
      estimatedMinutes: mins,
      tags: [],
    });
    if (quickType === 'daily') {
      if (activeAttentionTasks.length < settings.manaMax) {
        addAttentionTask(newTask.id, settings.manaMax);
      }
    }
    setQuickOpen(false);
    setQuickName('');
    setQuickMinutes('30');
    toast.success('悬赏已发布', { description: newTask.name });
  };

  const handleSetTracking = (taskId: string) => {
    setTrackingTask(taskId);
    toast.success('已设为追踪任务');
  };

  const handleAddAttention = (taskId: string) => {
    if (activeAttentionTasks.length >= settings.manaMax) {
      toast.error('专注槽已满', { description: '请先完成其他注意力任务' });
      return;
    }
    addAttentionTask(taskId, settings.manaMax);
    toast.success('已加入注意力任务');
  };

  const handleOpenTask = (task: IQuestTask) => {
    if (task.projectId) {
      navigate(`/projects/${task.projectId}`);
      return;
    }
    navigate('/quest-pool');
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            今日任务
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            专注你的主线任务，击败 Boss 赢得荣耀
          </p>
        </div>
        <TimeAccountPanel />
        <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-primary to-warning text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40">
              <Plus className="h-4 w-4" />
              快速悬赏
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                发布新悬赏
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>任务名称</Label>
                <Input
                  value={quickName}
                  onChange={(e) => setQuickName(e.target.value)}
                  placeholder="输入任务名称..."
                  className="bg-secondary/50"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>预估用时（分钟）</Label>
                  <Input
                    type="number"
                    value={quickMinutes}
                    onChange={(e) => setQuickMinutes(e.target.value)}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>难度</Label>
                  <Select
                    value={quickDifficulty}
                    onValueChange={(v) => setQuickDifficulty(v as TaskDifficulty)}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="easy">简单</SelectItem>
                      <SelectItem value="normal">普通</SelectItem>
                      <SelectItem value="hard">困难</SelectItem>
                      <SelectItem value="epic">史诗</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>任务类型</Label>
                <Select value={quickType} onValueChange={(v) => setQuickType(v as 'daily' | 'epic')}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="daily">每日悬赏</SelectItem>
                    <SelectItem value="epic">史诗任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setQuickOpen(false)}
                className="bg-secondary/60"
              >
                取消
              </Button>
              <Button
                onClick={handleQuickSubmit}
                className="bg-gradient-to-r from-primary to-warning text-primary-foreground font-semibold"
              >
                发布悬赏
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* P1-B：执行情境筛选（多选 OR） */}
      <section className="w-full">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">情境筛选：</span>
          {(Object.keys(CONTEXT_LABELS) as ExecutionContext[]).map((c) => {
            const on = activeContexts.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleContext(c)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  on
                    ? 'bg-primary/15 border-primary/50 text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {CONTEXT_LABELS[c]}
              </button>
            );
          })}
          {activeContexts.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveContexts([])}
              className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              清除
            </button>
          )}
        </div>
        {activeContexts.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            仅显示标注了所选情境的任务；未标注情境的任务会被隐藏。
          </p>
        )}
      </section>

      {/* P2-C1：DDL 倒排每日所需提示（站内，无系统打扰） */}
      {ddlReverse && (
        <section>
          <div
            className={cn(
              'flex items-start gap-2.5 rounded-md border px-4 py-3',
              ddlReverse.daysLeft <= 1
                ? 'border-destructive/50 bg-destructive/[0.09]'
                : ddlReverse.daysLeft <= 3
                  ? 'border-warning/50 bg-warning/[0.09]'
                  : 'border-info/50 bg-info/[0.09]'
            )}
          >
            <Clock className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm leading-relaxed">
              <span className="font-semibold">📅 DDL 倒排：</span>
              最早截止日 {new Date(ddlReverse.deadline).toLocaleDateString('zh-CN')} 还有{' '}
              <span className="font-bold">{ddlReverse.daysLeft}</span> 天，建议每天至少投入{' '}
              <span className="font-bold">{formatMinutes(ddlReverse.perDay)}</span>。
            </div>
          </div>
        </section>
      )}

      {/* 法力水晶满槽软提示 */}
      {activeAttentionTasks.length >= settings.manaMax && oldestAttentionTask && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-warning/50 bg-warning/[0.09] px-4 py-3 shadow-[0_0_0_1px_rgba(255,170,60,0.15)]">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-warning">
                💎 法力水晶已满（当前 {activeAttentionTasks.length}/{settings.manaMax}）
              </div>
              <p className="text-xs text-warning/80 mt-0.5 leading-relaxed">
                建议先完成 1 个注意力任务，或一键移回最老的注意力任务
                {`「${oldestAttentionTask.name}」`}
                （预估 {oldestAttentionTask.estimatedMinutes} 分钟）
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMoveBackOldestAttention}
            className="shrink-0 gap-1.5 border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
          >
            <ArrowLeftCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">移回悬赏池</span>
            <span className="sm:hidden">移回</span>
          </Button>
        </div>
      )}

      {(highestValueTask || biggestGrowthTask) && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {highestValueTask && (
            <RecommendationCard
              title="今日最高价值任务"
              subtitle="优先回报最高的一项"
              accent="primary"
              task={highestValueTask}
              goalName={highestValueTask.goalId ? goalNameMap.get(highestValueTask.goalId) : undefined}
              projectName={highestValueTask.projectId ? projectNameMap.get(highestValueTask.projectId) : undefined}
              onTrack={() => handleSetTracking(highestValueTask.id)}
              onFocus={() => handleAddAttention(highestValueTask.id)}
              onOpen={() => handleOpenTask(highestValueTask)}
            />
          )}
          {biggestGrowthTask && (
            <RecommendationCard
              title="今日最大成长任务"
              subtitle="优先推动能力增长的一项"
              accent="accent"
              task={biggestGrowthTask}
              goalName={biggestGrowthTask.goalId ? goalNameMap.get(biggestGrowthTask.goalId) : undefined}
              projectName={biggestGrowthTask.projectId ? projectNameMap.get(biggestGrowthTask.projectId) : undefined}
              onTrack={() => handleSetTracking(biggestGrowthTask.id)}
              onFocus={() => handleAddAttention(biggestGrowthTask.id)}
              onOpen={() => handleOpenTask(biggestGrowthTask)}
            />
          )}
        </section>
      )}

      {/* 追踪任务区 */}
      <section className="w-full">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold text-foreground">追踪任务</h2>
          <Badge variant="outline" className="text-xs border-primary/40 text-primary">
            主线 · 唯一
          </Badge>
        </div>

        <AnimatePresence mode="wait">
          {trackingTask ? (
            <motion.div
              key="tracking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-xl shadow-primary/10 overflow-hidden relative">
                {/* 发光边框装饰 */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-accent/10 blur-3xl rounded-full" />
                </div>

                <CardContent className="p-6 relative">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* 左侧：任务信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={`${DIFFICULTY_COLOR[trackingTask.difficulty]} border`}>
                          {DIFFICULTY_LABEL[trackingTask.difficulty]}
                        </Badge>
                        <Badge variant="outline" className="border-border/60 text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          预估 {trackingTask.estimatedMinutes} 分钟
                        </Badge>
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                        <Swords className="h-5 w-5 text-primary shrink-0" />
                        <span className="truncate">{trackingTask.name}</span>
                      </h3>
                      {trackingTask.bossName && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Zap className="h-3 w-3 text-warning" />
                              Boss: {trackingTask.bossName}
                            </span>
                            <span className="text-primary font-semibold">
                              {trackingTask.bossProgress}%
                            </span>
                          </div>
                          <Progress
                            value={trackingTask.bossProgress}
                            className="h-2 bg-secondary/60"
                          />
                        </div>
                      )}
                    </div>

                    {/* 右侧：计时器 + 控制 */}
                    <div className="flex flex-col items-center gap-4 lg:border-l lg:border-border/40 lg:pl-6">
                      <div className="text-center">
                        <div className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mb-1">
                          专注计时
                        </div>
                        <div className="font-mono text-5xl font-bold text-foreground tabular-nums tracking-tight">
                          {formatDuration(currentTrackSeconds)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {isTrackingRunning ? (
                            <span className="text-success flex items-center justify-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                              计时中
                            </span>
                          ) : (
                            <span className="text-muted-foreground">已暂停</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isTrackingRunning ? (
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={pauseTracking}
                            className="gap-2 bg-secondary/80 hover:bg-secondary"
                          >
                            <Pause className="h-4 w-4" />
                            暂停
                          </Button>
                        ) : (
                          <Button
                            size="lg"
                            onClick={startTracking}
                            className="gap-2 bg-gradient-to-r from-primary to-warning text-primary-foreground font-semibold shadow-lg shadow-primary/30"
                          >
                            <Play className="h-4 w-4" />
                            开始专注
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => requestComplete(trackingTask)}
                          className="gap-2 border-success/40 text-success hover:bg-success/10 hover:text-success"
                        >
                          <Check className="h-4 w-4" />
                          完成
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="no-tracking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="border-dashed border-border/60 bg-secondary/20">
                <CardContent className="p-8 text-center">
                  <Target className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-foreground mb-1">尚未选择追踪任务</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    从下方悬赏池中选择一个任务设为今日主线
                  </p>
                  {filteredPendingTasks.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {filteredPendingTasks.slice(0, 3).map((t) => (
                        <Button
                          key={t.id}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSetTracking(t.id)}
                          className="gap-1.5"
                        >
                          <ChevronRight className="h-3 w-3" />
                          <span className="max-w-[160px] truncate">{t.name}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* 注意力任务区 */}
      <section className="w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-bold text-foreground">注意力任务</h2>
            <Badge variant="outline" className="text-xs border-accent/40 text-accent">
              专注槽 {activeAttentionTasks.length}/{settings.manaMax}
            </Badge>
          </div>
        </div>

        {activeAttentionTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {activeAttentionTasks.map((task) => (
                <AttentionTaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => requestComplete(task)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <Card className="border-dashed border-border/60 bg-secondary/20">
            <CardContent className="p-6 text-center">
              <Zap className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                暂无注意力任务，从悬赏池中添加或快速发布新悬赏
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQuickOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  快速发布
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/quest-pool')}
                  className="gap-1.5"
                >
                  <Swords className="h-3.5 w-3.5" />
                  前往悬赏池
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 待激活悬赏池 */}
      {filteredPendingTasks.length > 0 && (
        <section className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <Swords className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">待激活悬赏</h2>
            <span className="text-xs text-muted-foreground">
              ({filteredPendingTasks.length} 个待处理)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredPendingTasks.map((task) => (
              <Card
                key={task.id}
                className="border-border/50 bg-card/60 hover:bg-card transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-medium text-foreground text-sm flex-1 min-w-0 truncate">
                      {task.name}
                    </h4>
                    <Badge
                      className={`${DIFFICULTY_COLOR[task.difficulty]} border text-[10px] px-1.5 py-0 shrink-0`}
                    >
                      {DIFFICULTY_LABEL[task.difficulty]}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Clock className="h-3 w-3" />
                    <span>{task.estimatedMinutes} 分钟</span>
                    <span>·</span>
                    <span className="text-primary">+{task.rewardReputation} 声望</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 text-xs gap-1"
                      onClick={() => handleSetTracking(task.id)}
                    >
                      <Target className="h-3 w-3" />
                      设为追踪
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs gap-1 border-accent/30 text-accent hover:bg-accent/10 hover:text-accent"
                      onClick={() => handleAddAttention(task.id)}
                    >
                      <Zap className="h-3 w-3" />
                      加入注意力
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <AlertDialog open={confirmCompleteTask !== null} onOpenChange={(open) => !open && setConfirmCompleteTask(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>确认完成任务</AlertDialogTitle>
            <AlertDialogDescription>
              确认完成「{confirmCompleteTask?.name}」？完成后将获得 {confirmCompleteTask?.rewardReputation} 声望。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCompleteTask(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmComplete} className="bg-success hover:bg-success/90">
              确认完成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RecommendationCard({
  title,
  subtitle,
  accent,
  task,
  goalName,
  projectName,
  onTrack,
  onFocus,
  onOpen,
}: {
  title: string;
  subtitle: string;
  accent: 'primary' | 'accent';
  task: IQuestTask;
  goalName?: string;
  projectName?: string;
  onTrack: () => void;
  onFocus: () => void;
  onOpen: () => void;
}) {
  const accentClass =
    accent === 'primary'
      ? 'from-primary/12 to-primary/5 border-primary/20'
      : 'from-accent/12 to-accent/5 border-accent/20';

  return (
    <Card className={`border bg-gradient-to-br ${accentClass}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Badge className={`${DIFFICULTY_COLOR[task.difficulty]} border`}>
            {DIFFICULTY_LABEL[task.difficulty]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="font-semibold text-foreground">{task.name}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {task.description || '这项任务已经具备开始条件，可以直接推进。'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{task.estimatedMinutes} 分钟</Badge>
          <Badge variant="outline">+{task.rewardReputation} 声望</Badge>
          {task.rewardSkillPoints > 0 ? <Badge variant="outline">+{task.rewardSkillPoints} 能力点</Badge> : null}
          {goalName ? <Badge variant="outline">目标：{goalName}</Badge> : null}
          {projectName ? <Badge variant="outline">项目：{projectName}</Badge> : null}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onTrack} className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            设为追踪
          </Button>
          <Button size="sm" variant="outline" onClick={onFocus} className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            加入注意力
          </Button>
          <Button size="sm" variant="outline" onClick={onOpen} className="gap-1.5">
            <ChevronRight className="h-3.5 w-3.5" />
            查看
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AttentionTaskCard({
  task,
  onComplete,
}: {
  task: IQuestTask;
  onComplete: () => void;
}) {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleClick = () => {
    if (isCompleting) return;
    setIsCompleting(true);
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, x: 20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -3 }}
    >
      <Card
        className={`border-border/60 bg-card overflow-hidden cursor-pointer transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 relative group ${
          isCompleting ? 'opacity-50 scale-95' : ''
        }`}
        onClick={handleClick}
      >
        {/* 完成粒子光效 */}
        <AnimatePresence>
          {isCompleting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none z-10"
            >
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: '50%', y: '50%', opacity: 1, scale: 0.5 }}
                  animate={{
                    x: `${50 + Math.cos((i * Math.PI) / 4) * 60}%`,
                    y: `${50 + Math.sin((i * Math.PI) / 4) * 60}%`,
                    opacity: 0,
                    scale: 1.2,
                  }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute top-1/2 left-1/2 h-2 w-2 rounded-full bg-success shadow-[0_0_10px_var(--color-success)]"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge
                  className={`${DIFFICULTY_COLOR[task.difficulty]} border text-[10px]`}
                >
                  {DIFFICULTY_LABEL[task.difficulty]}
                </Badge>
                {task.type === 'epic' && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    史诗
                  </Badge>
                )}
              </div>
              <h4 className="font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {task.name}
              </h4>
            </div>
            <div className="shrink-0 size-10 rounded-full border border-border/60 bg-secondary/40 flex items-center justify-center group-hover:bg-success/20 group-hover:border-success/50 transition-all">
              <Check className="h-5 w-5 text-muted-foreground group-hover:text-success transition-colors" />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {task.estimatedMinutes} 分钟
              </span>
            </div>
            <span className="text-primary font-semibold flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              +{task.rewardReputation}
            </span>
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

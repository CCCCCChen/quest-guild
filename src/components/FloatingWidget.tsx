import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  Check,
  Plus,
  Maximize2,
  Minimize2,
  Gem,
  Target,
  ListChecks,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTasks } from '@/hooks/useTasks';
import { useShop } from '@/hooks/useShop';
import { useSettings } from '@/hooks/useSettings';
import { useFloatingMode } from '@/hooks/useFloatingMode';
import { formatDuration, cn } from '@/lib/utils';
import type { IQuestTask, TaskDifficulty } from '@/types/quest';
import { toast } from 'sonner';
import { Trophy } from 'lucide-react';

const DIFFICULTY_COLORS: Record<TaskDifficulty, string> = {
  easy: 'bg-success/15 text-success border-success/30',
  normal: 'bg-info/15 text-info border-info/30',
  hard: 'bg-warning/15 text-warning border-warning/30',
  epic: 'bg-accent/15 text-accent border-accent/30',
};

const DIFFICULTY_LABELS: Record<TaskDifficulty, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  epic: '史诗',
};

const FLOAT_WIDTH = 380;

export default function FloatingWidget({ isWindowMode = false }: { isWindowMode?: boolean }) {
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
  } = useTasks();
  const { addReputation } = useShop();
  const { settings, updateSettings } = useSettings();
  const { setFullMode } = useFloatingMode();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickMinutes, setQuickMinutes] = useState('25');
  const [quickDifficulty, setQuickDifficulty] = useState<TaskDifficulty>('normal');
  const widgetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const DRAG_THRESHOLD = 3; // 移动超过此像素视为拖拽
  const expandedDragRef = useRef({
    startX: 0, startY: 0, originX: 0, originY: 0, moved: false,
  });

  const isTrackingRunning = activeTrack?.isRunning ?? false;

  const electronApi = typeof window !== 'undefined' ? (window as any).electronAPI : null;

  // Electron 下读取窗口实际位置；浏览器模式使用 settings.floatingPosition
  const getElectronWindowPos = useCallback(() => {
    if (!isWindowMode || !electronApi?.window?.getFloatPositionSync) return null;
    return electronApi.window.getFloatPositionSync() as { x: number; y: number } | null;
  }, [isWindowMode, electronApi]);

  const moveElectronWindow = useCallback(
    (x: number, y: number) => {
      if (!isWindowMode || !electronApi?.window?.setFloatPosition) return;
      electronApi.window.setFloatPosition(x, y);
    },
    [isWindowMode, electronApi],
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return tasks.filter(
      (t) =>
        t.status === 'completed' &&
        t.completedAt &&
        new Date(t.completedAt).toDateString() === today,
    ).length;
  }, [tasks]);

  const totalActiveToday = useMemo(() => {
    return (
      activeAttentionTasks.length +
      (trackingTask ? 1 : 0) +
      tasks.filter((t) => t.status === 'pending' && !t.parentId).length
    );
  }, [activeAttentionTasks, trackingTask, tasks]);

  const position = settings.floatingPosition;
  const opacity = settings.floatingOpacity;

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    if (isWindowMode) {
      const api = (window as any).electronAPI?.window;
      api?.expandFloat?.();
    }
  }, [isWindowMode]);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    if (isWindowMode) {
      const api = (window as any).electronAPI?.window;
      api?.collapseFloat?.();
    }
  }, [isWindowMode]);

  // 展开后测量内容实际高度调整 Electron 窗口
  useEffect(() => {
    if (!isExpanded || !isWindowMode) return;
    const api = (window as any).electronAPI?.window;
    if (!api?.setHeight) return;

    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      const contentH = contentRef.current.scrollHeight;
      if (contentH < 50) return;
      const headerH = 52;
      const footerH = 36;
      const padding = 8;
      api.setHeight(headerH + contentH + footerH + padding);
    }, 280);
    return () => clearTimeout(timer);
  }, [isExpanded, isWindowMode, trackingTask?.id, activeAttentionTasks.length, quickOpen]);

  // 拖拽：按下立即监听 mousemove，超过阈值进入拖拽
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStateRef.current.startX;
      const dy = e.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        dragStateRef.current.moved = true;
      }
      const nextX = dragStateRef.current.originX + dx;
      const nextY = dragStateRef.current.originY + dy;

      if (isWindowMode) {
        moveElectronWindow(nextX, nextY);
        updateSettings({ floatingPosition: { x: nextX, y: nextY } });
      } else {
        updateSettings({ floatingPosition: { x: nextX, y: nextY } });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      // 延迟重置 moved，让 click/dblclick 能读到正确值
      setTimeout(() => { dragStateRef.current.moved = false; }, 0);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isWindowMode, moveElectronWindow, updateSettings, DRAG_THRESHOLD]);

  const handleComplete = useCallback(
    (task: IQuestTask) => {
      completeTask(task.id);
      addReputation(task.rewardReputation);
      toast.success(`任务完成！获得 ${task.rewardReputation} 声望`, {
        description: task.name,
        icon: <Trophy className="h-4 w-4 text-primary" />,
      });
    },
    [completeTask, addReputation],
  );

  const handleQuickSubmit = useCallback(() => {
    if (!quickName.trim()) return;
    const mins = parseInt(quickMinutes, 10) || 25;
    const newTask = addTask({
      name: quickName.trim(),
      description: '',
      type: 'daily',
      difficulty: quickDifficulty,
      importance: 'medium',
      estimatedMinutes: mins,
      tags: [],
    });
    if (activeAttentionTasks.length < settings.manaMax) {
      addAttentionTask(newTask.id, settings.manaMax);
    }
    setQuickOpen(false);
    setQuickName('');
    setQuickMinutes('25');
    toast.success('悬赏已发布', { description: newTask.name });
  }, [
    quickName, quickMinutes, quickDifficulty, addTask,
    activeAttentionTasks.length, settings.manaMax, addAttentionTask,
  ]);

  const handleSetTracking = useCallback(
    (taskId: string) => {
      setTrackingTask(taskId);
      toast.success('已设为追踪任务');
    },
    [setTrackingTask],
  );

  const handleExpandMain = useCallback(() => {
    setFullMode();
    const electronApi = (window as any).electronAPI;
    if (electronApi?.window?.showMain) {
      electronApi.window.showMain();
    } else {
      toast.success('已展开主界面');
    }
  }, [setFullMode]);

  const handleCollapsedDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragStateRef.current.moved) return;
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      handleExpand();
    },
    [handleExpand],
  );

  const handleHeaderDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (expandedDragRef.current.moved) return;
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      handleCollapse();
    },
    [handleCollapse],
  );

  return (
    <div
      ref={widgetRef}
      style={
        isWindowMode
          ? { width: '100%', height: '100%' }
          : {
              position: 'fixed',
              right: '24px',
              bottom: '24px',
              zIndex: 9999,
              width: isExpanded ? FLOAT_WIDTH : undefined,
            }
      }
      className="select-none"
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="collapsed"
            initial={isWindowMode ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            animate={
              isWindowMode
                ? { opacity: 1 }
                : { opacity: isDragging ? opacity * 0.5 : opacity, scale: isDragging ? 0.96 : 1, y: 0 }
            }
            exit={isWindowMode ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={isWindowMode ? { width: '100%', height: '100%' } : undefined}
            className={cn(
              isWindowMode
                ? 'w-full h-full rounded-2xl overflow-hidden'
                : 'rounded-2xl cursor-pointer overflow-hidden',
              'bg-card backdrop-blur border border-primary/40',
              'relative',
              'hover:border-primary/50',
            )}
          >
            {/* 收起态交互区 */}
            <div className="flex flex-col w-full h-full select-none relative">
              {/* 拖拽手柄（仅 Electron，6px 窄条负责原生拖拽） */}
              {isWindowMode && (
                <div style={{
                  WebkitAppRegion: 'drag',
                  height: 12,
                  width: '100%',
                  flexShrink: 0,
                  cursor: 'grab',
                  background: 'linear-gradient(rgba(202,166,54,0.35) 1px, transparent 1px) 50% 3px / 18px 1px no-repeat, linear-gradient(rgba(202,166,54,0.35) 1px, transparent 1px) 50% 5px / 18px 1px no-repeat, linear-gradient(rgba(202,166,54,0.35) 1px, transparent 1px) 50% 7px / 18px 1px no-repeat, rgba(202,166,54,0.05)',
                } as CSSProperties} />
              )}
              <div
                onDoubleClick={handleCollapsedDoubleClick}
                style={isWindowMode ? ({ WebkitAppRegion: 'no-drag', flex: 1, cursor: 'pointer' } as CSSProperties) : undefined}
                className="flex items-center gap-0 px-1 pt-1 relative cursor-pointer">
              {/* 左侧：任务/播放控制 */}
              <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2">
                {trackingTask ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTrackingRunning) { pauseTracking(); } else { startTracking(); }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      {isTrackingRunning ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </Button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-foreground truncate leading-tight">
                          {trackingTask.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] text-primary tabular-nums font-semibold">
                          {formatDuration(currentTrackSeconds)}
                        </span>
                        {isTrackingRunning ? (
                          <span className="flex items-center gap-1 text-[10px] text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                            专注中
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {trackingTask.estimatedMinutes}分钟
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-9 w-9 shrink-0 rounded-full bg-secondary/40 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-muted-foreground leading-tight">
                        双击展开控制台
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {completedToday} 个任务已完成
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 右侧：快速状态 */}
              <div className="flex items-center gap-2.5 pr-3 pl-2 border-l border-border/30 py-2">
                <div className="flex items-center gap-1" title="专注槽">
                  <Gem className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[11px] tabular-nums text-accent font-medium">
                    {activeAttentionTasks.length}
                  </span>
                </div>
                <div className="flex items-center gap-1" title="今日完成">
                  <Check className="h-3.5 w-3.5 text-success" />
                  <span className="text-[11px] tabular-nums text-success font-medium">
                    {completedToday}
                  </span>
                </div>
              </div>
            </div>
          </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'rounded-2xl overflow-hidden',
              'bg-card backdrop-blur border border-primary/40',
            )}
            style={isWindowMode ? { width: '100%' } : { width: FLOAT_WIDTH }}
          >
            {/* 头部 */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-gradient-to-r from-primary/8 via-transparent to-accent/8 relative"
            >
              {/* 拖拽手柄（仅 Electron，渐变窄条指示可拖拽区域） */}
              {isWindowMode && (
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{
                    WebkitAppRegion: 'drag',
                    height: 6,
                    cursor: 'grab',
                    background: 'linear-gradient(rgba(202,166,54,0.3) 1px, transparent 1px) 50% 2px / 14px 1px no-repeat, linear-gradient(rgba(202,166,54,0.3) 1px, transparent 1px) 50% 4px / 14px 1px no-repeat, rgba(202,166,54,0.05)',
                  } as CSSProperties}
                />
              )}
              {/* 标题栏：双击缩小 */}
              <div
                onDoubleClick={handleHeaderDoubleClick}
                style={isWindowMode ? ({ WebkitAppRegion: 'no-drag' } as CSSProperties) : undefined}
                className="flex-1 flex items-center gap-2 cursor-pointer select-none"
              >
                <div className="size-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20 pointer-events-none">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <div className="pointer-events-none">
                  <div className="text-[13px] font-bold text-foreground leading-tight">悬赏任务公会</div>
                  <div className="text-[10px] text-muted-foreground">
                    {trackingTask ? '专注中' : '悬浮控制台'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={handleCollapse}
                  title="收起"
                >
                  <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  onClick={handleExpandMain}
                  title="展开主界面"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* 内容区 */}
            <div ref={contentRef} className={isWindowMode ? 'max-h-[440px] overflow-y-auto' : 'overflow-y-auto'} style={isWindowMode ? undefined : { maxHeight: 'calc(100vh - 160px)' }}>
              <div className="p-3 space-y-3">
                {/* 追踪任务卡 */}
                {trackingTask ? (
                  <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 to-primary/3 p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-primary/40 text-primary bg-primary/10"
                          >
                            追踪中
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] h-5 px-1.5', DIFFICULTY_COLORS[trackingTask.difficulty])}
                          >
                            {DIFFICULTY_LABELS[trackingTask.difficulty]}
                          </Badge>
                        </div>
                        <div className="text-[13px] font-semibold text-foreground truncate">
                          {trackingTask.name}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-xl font-bold text-primary tabular-nums leading-none">
                          {formatDuration(currentTrackSeconds)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          /{trackingTask.estimatedMinutes}分钟
                        </div>
                      </div>
                    </div>

                    {/* 进度条 */}
                    <div className="space-y-1">
                      <Progress
                        value={Math.min(
                          100,
                          Math.round((currentTrackSeconds / 60 / trackingTask.estimatedMinutes) * 100),
                        )}
                        className="h-1 bg-secondary/60"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isTrackingRunning ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={pauseTracking}
                          className="flex-1 h-8 gap-1.5 text-xs"
                        >
                          <Pause className="h-3 w-3" />
                          暂停
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={startTracking}
                          className="flex-1 h-8 gap-1.5 text-xs bg-gradient-to-r from-primary to-warning text-primary-foreground shadow-sm"
                        >
                          <Play className="h-3 w-3 ml-0.5" />
                          开始专注
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleComplete(trackingTask)}
                        className="h-8 gap-1 text-xs border-success/30 text-success hover:bg-success/10 hover:text-success px-3"
                      >
                        <Check className="h-3 w-3" />
                        完成
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/50 bg-secondary/15 p-4 text-center">
                    <Target className="h-5 w-5 text-muted-foreground mx-auto mb-1.5 opacity-50" />
                    <div className="text-[13px] text-muted-foreground">暂无追踪任务</div>
                    <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                      从下方选择一个开始专注
                    </div>
                  </div>
                )}

                {/* 注意力任务列表 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <Gem className="h-3.5 w-3.5 text-accent" />
                      <span className="text-xs font-semibold text-foreground">注意力任务</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {activeAttentionTasks.length}/{settings.manaMax}
                    </span>
                  </div>

                  {activeAttentionTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/40 bg-secondary/10 p-2.5 text-center">
                      <div className="text-[11px] text-muted-foreground">暂无激活的注意力任务</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {activeAttentionTasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            'group flex items-center gap-1.5 p-2 rounded-lg',
                            'border border-border/40 bg-secondary/25',
                            'hover:border-accent/40 hover:bg-accent/8',
                            'transition-colors',
                          )}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 rounded-md opacity-60 group-hover:opacity-100 hover:bg-success/15 hover:text-success transition-all"
                            onClick={() => handleComplete(task)}
                            title="完成"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-foreground truncate leading-tight">
                              {task.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span>{task.estimatedMinutes}分钟</span>
                              {task.difficulty !== 'normal' && (
                                <Badge
                                  variant="outline"
                                  className={cn('text-[9px] h-3.5 px-1 leading-none', DIFFICULTY_COLORS[task.difficulty])}
                                >
                                  {DIFFICULTY_LABELS[task.difficulty]}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {!trackingTask && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 rounded-md opacity-0 group-hover:opacity-100 hover:bg-primary/15 hover:text-primary transition-all"
                              onClick={() => handleSetTracking(task.id)}
                              title="设为追踪"
                            >
                              <Target className="h-3 w-3" />
                            </Button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 快速悬赏 */}
                <div className="space-y-1.5">
                  {!quickOpen ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 gap-1.5 text-xs border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 rounded-lg"
                      onClick={() => setQuickOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      快速发布悬赏
                    </Button>
                  ) : (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">快速悬赏</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 rounded-md hover:bg-secondary/60"
                          onClick={() => setQuickOpen(false)}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                      <Input
                        value={quickName}
                        onChange={(e) => setQuickName(e.target.value)}
                        placeholder="任务名称..."
                        className="h-8 text-xs rounded-lg"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSubmit(); }}
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={quickMinutes}
                          onChange={(e) => setQuickMinutes(e.target.value)}
                          className="h-8 w-20 text-xs text-center rounded-lg"
                          min={5}
                        />
                        <span className="text-[11px] text-muted-foreground">分钟</span>
                        <select
                          value={quickDifficulty}
                          onChange={(e) => setQuickDifficulty(e.target.value as TaskDifficulty)}
                          className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="easy">简单</option>
                          <option value="normal">普通</option>
                          <option value="hard">困难</option>
                          <option value="epic">史诗</option>
                        </select>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleQuickSubmit}
                        className="w-full h-8 gap-1.5 text-xs bg-gradient-to-r from-primary to-warning text-primary-foreground rounded-lg"
                        disabled={!quickName.trim()}
                      >
                        <Plus className="h-3 w-3" />
                        发布悬赏
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 底部状态条 */}
            <div className="px-4 py-2 border-t border-border/40 bg-secondary/20 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  今日 {completedToday}/{totalActiveToday}
                </span>
                <span className="flex items-center gap-1">
                  <Gem className="h-3 w-3 text-accent" />
                  专注槽 {activeAttentionTasks.length}/{settings.manaMax}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

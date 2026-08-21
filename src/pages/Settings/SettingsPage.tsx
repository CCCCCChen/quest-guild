import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Bot,
  Gem,
  Clock,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  Shield,
  Info,
  Sparkles,
  MonitorDot,
  Move,
  TimerReset,
  History,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Cloud,
  Database,
  Merge,
  FileSpreadsheet,
  Calendar,
  Zap,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { playSound } from '@/lib/sound';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSettings } from '@/hooks/useSettings';
import { useSync } from '@/hooks/useSync';
import { useTasks } from '@/hooks/useTasks';
import { useGoals } from '@/hooks/useGoals';
import { useProjects } from '@/hooks/useProjects';
import { useSkills } from '@/hooks/useSkills';
import { loadAiConfig, saveAiConfig } from '@/lib/aiConfig';
import {
  listBackups,
  restoreBackup,
  createBackup,
  getStorageUsage,
  validateData,
  type IBackupInfo,
} from '@/lib/backup';
import {
  validateStorage,
  type StorageValidationReport,
  type ValidationIssue,
} from '@/lib/storageValidator';
import { computeBossProgressForParent } from '@/lib/taskCompletion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STORAGE_KEYS = [
  '__quest_guild_tasks',
  '__quest_guild_skills',
  '__quest_guild_skill_points',
  '__quest_guild_shop_items',
  '__quest_guild_reputation',
  '__quest_guild_redemptions',
  '__quest_guild_active_track',
  '__quest_guild_focus_log',
  '__quest_guild_settings',
  // P0-1：补齐目标 / 项目 / 复盘（与 backup.ts DATA_KEYS 保持一致）
  '__quest_guild_goals',
  '__quest_guild_projects',
  '__quest_guild_reflections',
];

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { state: syncState, syncNow } = useSync();
  const { tasks, updateTask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { skills } = useSkills();
  const [syncing, setSyncing] = useState(false);
  const [manaMax, setManaMax] = useState(settings.manaMax);
  const [resetTime, setResetTime] = useState(settings.resetTime);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [floatingOpacity, setFloatingOpacity] = useState(settings.floatingOpacity);
  const [floatingCollapseDelay, setFloatingCollapseDelay] = useState(settings.floatingCollapseDelay);
  const [backups, setBackups] = useState<IBackupInfo[]>([]);
  const [storageUsage, setStorageUsage] = useState(() => getStorageUsage());
  const [healthReport, setHealthReport] = useState<StorageValidationReport | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    valid: boolean;
    errors: string[];
    stats: { taskCount: number; skillCount: number; reputation: number; shopItemCount: number } | null;
    rawData: Record<string, unknown> | null;
    fileName: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('overwrite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 拆解配置（仅本地浏览器保存）
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');

  useEffect(() => {
    const cfg = loadAiConfig();
    setAiApiKey(cfg.apiKey);
    setAiBaseUrl(cfg.baseUrl);
    setAiModel(cfg.model);
  }, []);

  const handleSaveAiConfig = useCallback(() => {
    saveAiConfig({
      apiKey: aiApiKey.trim(),
      baseUrl: aiBaseUrl.trim() || 'https://api.openai.com/v1',
      model: aiModel.trim() || 'gpt-4o-mini',
    });
    toast.success('AI 拆解配置已保存', {
      description: '仅保存在本机浏览器，不会上传到任何服务器',
    });
  }, [aiApiKey, aiBaseUrl, aiModel]);

  const refreshBackups = useCallback(() => {
    setBackups(listBackups());
    setStorageUsage(getStorageUsage());
  }, []);

  useEffect(() => {
    refreshBackups();
  }, [refreshBackups]);

  // 当设置变化时同步本地状态（例如从其他页面切换回来）
  useEffect(() => {
    setManaMax(settings.manaMax);
    setResetTime(settings.resetTime);
    setSoundEnabled(settings.soundEnabled);
    setFloatingOpacity(settings.floatingOpacity);
    setFloatingCollapseDelay(settings.floatingCollapseDelay);
  }, [settings]);

  const handleManaChange = useCallback(
    (value: number[]) => {
      const v = value[0];
      setManaMax(v);
      updateSettings({ manaMax: v });
      toast.success(`专注槽上限已调整为 ${v}`, {
        description: '注意力任务最大并行数已更新',
      });
    },
    [updateSettings],
  );

  const handleResetTimeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setResetTime(v);
      updateSettings({ resetTime: v });
    },
    [updateSettings],
  );

  const handleSoundToggle = useCallback(
    (checked: boolean) => {
      setSoundEnabled(checked);
      updateSettings({ soundEnabled: checked });
      if (checked) {
        setTimeout(() => playSound('levelup'), 50);
        toast.success('音效已开启');
      } else {
        toast.info('音效已关闭');
      }
    },
    [updateSettings],
  );

  const handleOpacityChange = useCallback(
    (value: number[]) => {
      const v = value[0];
      setFloatingOpacity(v);
      updateSettings({ floatingOpacity: v });
    },
    [updateSettings],
  );

  const handleCollapseDelayChange = useCallback(
    (value: number[]) => {
      const v = value[0];
      setFloatingCollapseDelay(v);
      updateSettings({ floatingCollapseDelay: v });
    },
    [updateSettings],
  );

  const handleResetFloatingPosition = useCallback(() => {
    updateSettings({ floatingPosition: { x: -24, y: -24 } });
    toast.success('悬浮窗位置已重置', {
      description: '已恢复到右下角默认位置',
    });
  }, [updateSettings]);

  const handleExportData = useCallback(() => {
    const data: Record<string, unknown> = {};
    for (const key of STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          data[key] = raw;
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quest-guild-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('数据导出成功', {
      description: '所有公会数据已打包下载',
    });
  }, []);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string) as Record<string, unknown>;
          
          const hasAnyData = STORAGE_KEYS.some((k) => data[k] !== undefined);
          
          if (!hasAnyData) {
            toast.error('导入失败', {
              description: '文件中未找到有效数据',
            });
            return;
          }

          const snapshot: Record<string, string> = {};
          for (const key of STORAGE_KEYS) {
            if (data[key] !== undefined) {
              snapshot[key] = typeof data[key] === 'string' ? data[key] as string : JSON.stringify(data[key]);
            }
          }
          const validation = validateData(snapshot);

          let taskCount = 0;
          let skillCount = 0;
          let reputation = 0;
          let shopItemCount = 0;

          try {
            const tasks = data['__quest_guild_tasks'];
            if (Array.isArray(tasks)) taskCount = tasks.length;
            const skills = data['__quest_guild_skills'];
            if (Array.isArray(skills)) skillCount = skills.length;
            const rep = data['__quest_guild_reputation'];
            if (typeof rep === 'number') reputation = rep;
            else if (typeof rep === 'string') reputation = parseInt(rep, 10) || 0;
            const shopItems = data['__quest_guild_shop_items'];
            if (Array.isArray(shopItems)) shopItemCount = shopItems.length;
          } catch {
            // ignore
          }

          setImportPreview({
            valid: validation.valid,
            errors: validation.errors,
            stats: { taskCount, skillCount, reputation, shopItemCount },
            rawData: data,
            fileName: file.name,
          });
        } catch (err) {
          toast.error('导入失败', {
            description: '文件格式不正确，请检查备份文件',
          });
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [],
  );

  const handleConfirmImport = useCallback(() => {
    if (!importPreview?.rawData) return;
    const data = importPreview.rawData;

    if (importMode === 'overwrite') {
      for (const key of STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
    }

    let importedCount = 0;
    for (const key of STORAGE_KEYS) {
      if (data[key] !== undefined) {
        const value = typeof data[key] === 'string' ? (data[key] as string) : JSON.stringify(data[key]);
        if (importMode === 'merge') {
          const existing = localStorage.getItem(key);
          if (existing && (key === '__quest_guild_tasks' || key === '__quest_guild_shop_items' || key === '__quest_guild_redemptions' || key === '__quest_guild_focus_log')) {
            try {
              const existingArr = JSON.parse(existing) as Array<{ id?: string }>;
              const newArr = JSON.parse(value) as Array<{ id?: string }>;
              const existingIds = new Set(existingArr.map((item) => item.id));
              const merged = [...existingArr, ...newArr.filter((item) => item.id && !existingIds.has(item.id))];
              localStorage.setItem(key, JSON.stringify(merged));
              importedCount++;
              continue;
            } catch {
              // fall through to overwrite
            }
          }
        }
        localStorage.setItem(key, value);
        importedCount++;
      }
    }

    toast.success(`数据导入成功（${importMode === 'merge' ? '合并' : '覆盖'}模式）`, {
      description: `已导入 ${importedCount} 项数据，刷新页面生效`,
    });
    setImportPreview(null);
    refreshBackups();
    setTimeout(() => window.location.reload(), 1200);
  }, [importPreview, importMode, refreshBackups]);

  const handleRestoreBackup = useCallback(
    (backup: IBackupInfo) => {
      const ok = restoreBackup(backup.id);
      if (ok) {
        toast.success('备份恢复成功', {
          description: `已恢复到 ${new Date(backup.timestamp).toLocaleString()} 的数据`,
        });
        refreshBackups();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error('恢复失败', { description: '备份数据损坏或不存在' });
      }
    },
    [refreshBackups],
  );

  const handleManualBackup = useCallback(() => {
    const result = createBackup('手动备份', false);
    if (result) {
      toast.success('手动备份已创建', {
        description: `共 ${result.stats.taskCount} 个任务 · ${formatBytes(result.stats.totalBytes)}`,
      });
      refreshBackups();
    } else {
      toast.error('备份创建失败');
    }
  }, [refreshBackups]);

  const handleRunHealthCheck = useCallback(() => {
    const report = validateStorage({ tasks, skills, goals, projects });
    setHealthReport(report);
    setHealthOpen(true);
  }, [tasks, skills, goals, projects]);

  const handleAutoFixProgress = useCallback(() => {
    if (!healthReport) return;
    const progressWarnings = healthReport.issues.filter(
      (i) => i.level === 'warning' && i.message.includes('bossProgress') && i.taskId,
    );
    if (progressWarnings.length === 0) {
      toast.info('当前没有需要修复的进度异常');
      return;
    }
    let fixedCount = 0;
    for (const issue of progressWarnings) {
      const parentId = issue.taskId;
      if (!parentId) continue;
      const correctProgress = computeBossProgressForParent(tasks, parentId);
      const parent = tasks.find((t) => t.id === parentId);
      if (!parent || parent.bossProgress === correctProgress) continue;
      updateTask(parentId, { bossProgress: correctProgress });
      fixedCount++;
    }
    if (fixedCount > 0) {
      toast.success(`已修复 ${fixedCount} 条进度异常`, {
        description: '父任务 bossProgress 已对齐实际子女完成率',
      });
      setTimeout(() => {
        const newReport = validateStorage({ tasks, skills, goals, projects });
        setHealthReport(newReport);
      }, 300);
    } else {
      toast.info('无需修复，所有进度已对齐');
    }
  }, [healthReport, tasks, skills, goals, projects, updateTask]);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const handleResetAll = useCallback(() => {
    for (const key of STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    resetSettings();
    toast.success('数据已重置', {
      description: '所有数据已清除，刷新页面恢复初始状态',
    });
    setTimeout(() => window.location.reload(), 1000);
  }, [resetSettings]);

  const handleCloudSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncNow();
      toast.success('已同步到云端', {
        description: syncState.lastSyncAt
          ? `上次同步：${new Date(syncState.lastSyncAt).toLocaleString()}`
          : undefined,
      });
    } catch (e) {
      toast.error('同步失败', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncing(false);
    }
  }, [syncing, syncNow, syncState.lastSyncAt]);

  const manaCrystals = Array.from({ length: manaMax }, (_, i) => i);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
          <SettingsIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide">公会设置</h1>
          <p className="text-sm text-muted-foreground">调整你的冒险偏好与数据管理</p>
        </div>
      </motion.div>

      {/* 专注槽设置 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent/20">
                <Gem className="h-4 w-4 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">专注槽上限</CardTitle>
                <CardDescription className="text-xs">
                  决定你每天可同时激活的注意力任务数量
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center justify-center gap-2 py-2">
              {manaCrystals.map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 45 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.05, type: 'spring' }}
                  className="h-6 w-6 rotate-45 border-2 border-accent bg-accent/30 shadow-[0_0_12px_var(--color-accent)]"
                />
              ))}
              <span className="ml-3 text-lg font-bold tabular-nums text-foreground">
                {manaMax}
              </span>
              <span className="text-sm text-muted-foreground">颗</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">调整上限</Label>
                <span className="text-xs text-muted-foreground">1 ~ 10 颗</span>
              </div>
              <Slider
                value={[manaMax]}
                min={1}
                max={10}
                step={1}
                onValueChange={handleManaChange}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 每日重置时间 + 音效 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">每日重置时间</CardTitle>
                <CardDescription className="text-xs">
                  新的一天从这一刻开始计算
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={resetTime}
                onChange={handleResetTimeChange}
                className="max-w-[180px] font-mono text-lg tracking-wider"
              />
              <span className="text-sm text-muted-foreground">
                每日此时刷新悬赏与统计
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/20">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-success" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">音效反馈</CardTitle>
                <CardDescription className="text-xs">
                  任务完成、能力点亮时的音效提示
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {soundEnabled ? '音效已开启' : '音效已关闭'}
              </span>
              <Switch
                checked={soundEnabled}
                onCheckedChange={handleSoundToggle}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 悬浮窗设置 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20">
                <MonitorDot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">悬浮窗设置</CardTitle>
                <CardDescription className="text-xs">
                  桌面悬浮窗的显示与交互偏好
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* 透明度 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-foreground">收起态透明度</Label>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(floatingOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[floatingOpacity]}
                min={0.4}
                max={1}
                step={0.05}
                onValueChange={handleOpacityChange}
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground">
                悬浮条收起时的背景透明度，数值越低越通透
              </p>
            </div>

            {/* 收起延迟 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TimerReset className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-foreground">自动收起延迟</Label>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {floatingCollapseDelay} ms
                </span>
              </div>
              <Slider
                value={[floatingCollapseDelay]}
                min={300}
                max={3000}
                step={100}
                onValueChange={handleCollapseDelayChange}
                className="w-full"
              />
              <p className="text-[11px] text-muted-foreground">
                鼠标移出悬浮窗后，延迟多久自动收起为悬浮条
              </p>
            </div>

            {/* 位置重置 */}
            <div className="pt-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFloatingPosition}
                className="w-full gap-2"
              >
                <Move className="h-3.5 w-3.5" />
                重置悬浮窗位置
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 数据管理 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/20">
                <Shield className="h-4 w-4 text-warning" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">数据管理</CardTitle>
                <CardDescription className="text-xs">
                  备份、恢复、导入导出你的所有公会数据
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* 存储容量 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-foreground">存储空间</Label>
                </div>
                <span className="text-xs tabular-nums text-foreground">
                  {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.estimatedLimit)}
                </span>
              </div>
              <Progress value={storageUsage.usagePercent} className="h-2" />
              {storageUsage.usagePercent >= 80 && (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-xs text-warning">
                    存储空间已使用 {storageUsage.usagePercent}%，建议导出备份或清理旧数据
                  </div>
                </div>
              )}
            </div>

            {/* 导出 / 导入 / 备份 / 体检 按钮 */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Button
                variant="secondary"
                onClick={handleExportData}
                className="h-auto py-3 flex flex-col items-center gap-1.5 border border-border/50 bg-secondary/40 hover:bg-secondary/70"
              >
                <Download className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">导出数据</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  JSON 备份文件
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleImportClick}
                className="h-auto py-3 flex flex-col items-center gap-1.5 border border-border/50 bg-secondary/40 hover:bg-secondary/70"
              >
                <Upload className="h-4 w-4 text-info" />
                <span className="text-xs font-medium">导入数据</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  从备份恢复
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleManualBackup}
                className="h-auto py-3 flex flex-col items-center gap-1.5 border border-border/50 bg-secondary/40 hover:bg-secondary/70"
              >
                <RefreshCw className="h-4 w-4 text-success" />
                <span className="text-xs font-medium">立即备份</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  创建当前快照
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleRunHealthCheck}
                className="h-auto py-3 flex flex-col items-center gap-1.5 border border-border/50 bg-secondary/40 hover:bg-secondary/70"
              >
                <Shield className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium">立即体检</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  检查数据一致性
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            {/* 备份列表 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm text-foreground">备份记录</Label>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  保留最近 7 天每日备份 + 10 次操作备份
                </span>
              </div>

              {backups.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/50 bg-secondary/10 p-6 text-center">
                  <Database className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <div className="text-xs text-muted-foreground">暂无备份记录</div>
                  <div className="text-[10px] text-muted-foreground/60 mt-1">
                    数据变更时会自动创建备份
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {backups.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-secondary/20 px-3 py-2.5 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`size-8 rounded-md flex items-center justify-center shrink-0 ${
                          b.type === 'daily' ? 'bg-primary/15' : 'bg-accent/15'
                        }`}>
                          {b.type === 'daily' ? (
                            <Calendar className="h-4 w-4 text-primary" />
                          ) : (
                            <Zap className="h-4 w-4 text-accent" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] h-4 border-border/50 text-muted-foreground">
                              {b.type === 'daily' ? '每日备份' : '操作备份'}
                            </Badge>
                            <span className="text-xs font-medium text-foreground truncate">
                              {b.reason || '自动备份'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{new Date(b.timestamp).toLocaleString()}</span>
                            <span>{b.stats.taskCount} 任务</span>
                            <span>{formatBytes(b.stats.totalBytes)}</span>
                          </div>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] shrink-0">
                            恢复
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-border bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-warning" />
                              确认恢复此备份？
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <p>恢复将覆盖当前所有数据：</p>
                              <div className="rounded-md bg-secondary/40 p-3 text-xs space-y-1">
                                <div>备份时间：{new Date(b.timestamp).toLocaleString()}</div>
                                <div>任务数量：{b.stats.taskCount} 个</div>
                                <div>能力节点：{b.stats.skillCount} 个</div>
                                <div>公会声望：{b.stats.reputation.toLocaleString()}</div>
                                <div>数据大小：{formatBytes(b.stats.totalBytes)}</div>
                              </div>
                              <p className="text-warning text-xs">
                                ⚠️ 当前数据将被完全覆盖，此操作不可撤销
                              </p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRestoreBackup(b)}
                              className="bg-warning text-warning-foreground hover:bg-warning/90"
                            >
                              确认恢复
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-border/40">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="w-full h-auto py-3 flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>重置所有数据</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      确认重置所有数据？
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>此操作将永久删除以下数据，且无法恢复：</p>
                      <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                        <li>所有任务与悬赏记录</li>
                        <li>能力树进度与能力点</li>
                        <li>公会声望与商店兑换记录</li>
                        <li>专注时长统计</li>
                        <li>个人设置偏好</li>
                      </ul>
                      <p className="text-warning text-xs">
                        💡 建议先导出备份再重置
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      确认重置
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* AI 拆解配置 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">AI 拆解配置</CardTitle>
                <CardDescription className="text-xs">
                  配置 OpenAI 兼容接口，用于史诗任务的「AI 拆解」生成子任务草稿
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-foreground">API Key</Label>
              <Input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">Base URL</Label>
                <Input
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-foreground">模型</Label>
                <Input
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                密钥仅保存在本机浏览器，AI 请求由浏览器直连你的接口，不会经过任何中间服务器。
              </p>
              <Button onClick={handleSaveAiConfig} className="gap-2 shrink-0" size="sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 云端同步（Phase 2 B+ 延迟同步） */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20">
                <Cloud className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">云端同步</CardTitle>
                <CardDescription className="text-xs">
                  将公会数据（任务、声望、能力点）同步到云端工作台
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* 同步状态 */}
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/20 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {syncState.lastError ? (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">
                    {syncState.lastSyncAt
                      ? `上次同步：${new Date(syncState.lastSyncAt).toLocaleString()}`
                      : '尚未同步'}
                  </div>
                  {syncState.lastError && (
                    <div className="text-[10px] text-destructive truncate">{syncState.lastError}</div>
                  )}
                </div>
              </div>
              {syncState.dirtyTaskIds.length + syncState.deletedTaskIds.length > 0 && (
                <Badge variant="outline" className="border-warning/40 text-warning shrink-0">
                  {syncState.dirtyTaskIds.length + syncState.deletedTaskIds.length} 条待同步
                </Badge>
              )}
            </div>

            {/* 同步说明 + 按钮 */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                数据变更后会自动标记，关闭应用前与手动点击时推送到云端（最后写入优先）。
              </p>
              <Button
                onClick={handleCloudSync}
                disabled={syncing}
                className="h-9 shrink-0 gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中…' : '同步到云端'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 导入预览弹窗 */}
      {importPreview && (
        <AlertDialog open={!!importPreview} onOpenChange={(open) => !open && setImportPreview(null)}>
          <AlertDialogContent className="border-border bg-card max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-info" />
                数据导入确认
              </AlertDialogTitle>
              <AlertDialogDescription>
                文件：{importPreview.fileName}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              {/* 校验结果 */}
              <div className={`rounded-md border p-3 ${
                importPreview.valid
                  ? 'border-success/40 bg-success/10'
                  : 'border-destructive/40 bg-destructive/10'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  {importPreview.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`text-sm font-medium ${
                    importPreview.valid ? 'text-success' : 'text-destructive'
                  }`}>
                    {importPreview.valid ? '数据校验通过' : '数据存在问题'}
                  </span>
                </div>
                {importPreview.errors.length > 0 && (
                  <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 list-disc">
                    {importPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 数据预览 */}
              {importPreview.stats && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-center">
                    <div className="text-lg font-bold text-foreground tabular-nums">
                      {importPreview.stats.taskCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">任务数</div>
                  </div>
                  <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-center">
                    <div className="text-lg font-bold text-foreground tabular-nums">
                      {importPreview.stats.skillCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">能力数</div>
                  </div>
                  <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-center">
                    <div className="text-lg font-bold text-primary tabular-nums">
                      {importPreview.stats.reputation.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">公会声望</div>
                  </div>
                  <div className="rounded-md border border-border/40 bg-secondary/30 p-3 text-center">
                    <div className="text-lg font-bold text-foreground tabular-nums">
                      {importPreview.stats.shopItemCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground">商品数</div>
                  </div>
                </div>
              )}

              {/* 导入模式 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">导入模式</Label>
                <Tabs value={importMode} onValueChange={(v) => setImportMode(v as 'merge' | 'overwrite')}>
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="overwrite" className="gap-1.5 text-xs">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      覆盖模式
                    </TabsTrigger>
                    <TabsTrigger value="merge" className="gap-1.5 text-xs">
                      <Merge className="h-3.5 w-3.5" />
                      合并模式
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-[11px] text-muted-foreground">
                  {importMode === 'overwrite'
                    ? '完全覆盖当前所有数据，替换为导入文件的内容'
                    : '保留当前数据，按 ID 合并导入的任务、商品、兑换记录'}
                </p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setImportPreview(null)}>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmImport}
                className={importPreview.valid ? '' : 'bg-destructive hover:bg-destructive/90'}
              >
                确认导入
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 体检报告弹窗 */}
      <Dialog open={healthOpen} onOpenChange={setHealthOpen}>
        <DialogContent className="border-border bg-card max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning" />
              数据体检报告
            </DialogTitle>
            <DialogDescription>
              {healthReport
                ? healthReport.valid
                  ? `数据结构一致（校验指纹：${healthReport.checksum ?? '无'}）`
                  : '存在结构性错误，请修复后再进行备份或迁移'
                : '正在检查…'}
            </DialogDescription>
          </DialogHeader>

          {healthReport && (
            <div className="space-y-4">
              {/* 顶部总览 */}
              <div
                className={`rounded-md border p-3 ${
                  healthReport.valid
                    ? 'border-success/40 bg-success/10'
                    : 'border-destructive/40 bg-destructive/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  {healthReport.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      healthReport.valid ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {healthReport.valid ? '体检合格' : '存在错误'}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {healthReport.issues.filter((i) => i.level === 'error').length} 错误 ·{' '}
                    {healthReport.issues.filter((i) => i.level === 'warning').length} 警告
                  </span>
                </div>
              </div>

              {/* Error 列表 */}
              {(() => {
                const errors = healthReport.issues.filter((i) => i.level === 'error');
                if (errors.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-xs font-semibold text-destructive">结构性错误</span>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {errors.map((issue, idx) => (
                        <div
                          key={`e-${idx}`}
                          className="rounded-md border border-destructive/30 bg-destructive/[0.08] px-3 py-2"
                        >
                          <div className="text-[12px] text-destructive/90">{issue.message}</div>
                          {issue.taskId && (
                            <div className="mt-0.5 text-[10px] font-mono text-destructive/70">
                              taskId: {issue.taskId}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Warning 列表 */}
              {(() => {
                const warnings = healthReport.issues.filter((i) => i.level === 'warning');
                if (warnings.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <span className="text-xs font-semibold text-warning">一致性警告</span>
                    </div>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {warnings.map((issue, idx) => (
                        <div
                          key={`w-${idx}`}
                          className="rounded-md border border-warning/30 bg-warning/[0.08] px-3 py-2"
                        >
                          <div className="text-[12px] text-warning/90">{issue.message}</div>
                          {issue.taskId && (
                            <div className="mt-0.5 text-[10px] font-mono text-warning/70">
                              taskId: {issue.taskId}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {healthReport.issues.length === 0 && (
                <div className="rounded-md border border-border/40 bg-secondary/10 p-5 text-center">
                  <Sparkles className="h-5 w-5 text-success mx-auto mb-1.5" />
                  <div className="text-xs text-muted-foreground">
                    数据状态极佳，没有发现任何异常
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setHealthOpen(false)}
            >
              关闭
            </Button>
            <Button
              onClick={handleAutoFixProgress}
              disabled={
                !healthReport ||
                !healthReport.issues.some(
                  (i: ValidationIssue) => i.level === 'warning' && i.message.includes('bossProgress'),
                )
              }
            >
              <Wrench className="h-3.5 w-3.5" />
              一键修复进度异常
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 关于信息 */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">关于</CardTitle>
                <CardDescription className="text-xs">
                  悬赏任务公会 · Quest Guild
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>版本 2.0 · 冒险者大厅</span>
            </div>
            <p>
              一款以 RPG 游戏面板为视觉风格的轻量级目标管理工具。把人生目标变成史诗任务，
              通过任务拆解、专注追踪、能力成长和可视化奖励，提升你的规划力与执行力。
            </p>
            <p className="text-xs">
              所有数据存储在浏览器本地，不会上传到任何服务器。
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

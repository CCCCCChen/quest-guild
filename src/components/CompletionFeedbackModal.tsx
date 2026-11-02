// P0-F：完成即问反馈弹窗
//
// 监听 completeTask 派发的 `quest:ask-feedback` 事件，弹出相对按钮
// （挺准 / 慢一点 / 慢一倍 / 快很多 / 跳过），把反馈滚动写入 settings.estimationProfile，
// 用于动态校正同类任务的预估耗时。仅在任务带 contentType 时触发（无 contentType 无法 key）。

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { applyEstimationFeedback, FEEDBACK_LABELS, type FeedbackChoice } from '@/lib/feedback';
import type { TaskDifficulty, ContentType } from '@/types/quest';

interface PendingFeedback {
  taskId: string;
  taskName: string;
  difficulty: TaskDifficulty;
  contentType?: ContentType;
}

interface AskFeedbackEventDetail {
  taskId: string;
  taskName: string;
  difficulty: TaskDifficulty;
  contentType?: ContentType;
}

export function CompletionFeedbackModal() {
  const { settings, updateSettings } = useSettings();
  const [pending, setPending] = useState<PendingFeedback | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AskFeedbackEventDetail>).detail;
      if (!detail || !detail.contentType) return; // 无 contentType 无法校正，跳过
      setPending({
        taskId: detail.taskId,
        taskName: detail.taskName,
        difficulty: detail.difficulty,
        contentType: detail.contentType,
      });
      setOpen(true);
    };
    window.addEventListener('quest:ask-feedback', handler as EventListener);
    return () => window.removeEventListener('quest:ask-feedback', handler as EventListener);
  }, []);

  const handlePick = (choice: FeedbackChoice) => {
    if (pending && choice !== 'skip') {
      const next = applyEstimationFeedback(
        settings.estimationProfile,
        pending.contentType,
        pending.difficulty,
        choice,
      );
      updateSettings({ estimationProfile: next });
    }
    setOpen(false);
    setPending(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPending(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">这次预估准吗？</DialogTitle>
          <DialogDescription>
            {pending ? `「${pending.taskName}」` : ''}实际花的时间和预估差多少？你的反馈会帮 AI 越估越准。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {FEEDBACK_LABELS.filter((f) => f.choice !== 'skip').map((f) => (
            <Button
              key={f.choice}
              variant="outline"
              className="flex flex-col h-auto py-3 items-start gap-0.5"
              onClick={() => handlePick(f.choice)}
            >
              <span className="font-medium">{f.label}</span>
              <span className="text-[11px] text-muted-foreground font-normal">{f.hint}</span>
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handlePick('skip')}>
            跳过
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CompletionFeedbackModal;

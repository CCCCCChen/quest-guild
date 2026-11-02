// P2-C2：本地提醒引擎（Electron 渲染进程 / 浏览器通用，零原生模块）
//
// 机制：渲染进程定时轮询 tasks，对「未完成的、reminderAt 已过且尚未提醒过」的任务
// 触发 Notification API 系统通知。无需主进程调度，关闭窗口即停（自用场景足够）。
// - 首次挂载时按需申请 Notification 权限（仅申请一次，避免反复弹窗）。
// - 已提醒的 id 存 localStorage，避免重复打扰；任务消失/完成后自动从记录中清理。
import { useEffect, useRef } from 'react';
import { useTasks } from './useTasks';
import { store } from '@/lib/storage';

const NOTIFIED_KEY = '__quest_guild_notified_reminders';

function loadNotified(): Set<string> {
  try {
    const raw = store.getItem(NOTIFIED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveNotified(s: Set<string>): void {
  try {
    store.setItem(NOTIFIED_KEY, JSON.stringify([...s]));
  } catch {
    /* 忽略写入失败 */
  }
}

export function useReminderWatcher(pollMs = 60000): void {
  const { tasks } = useTasks();
  const tasksRef = useRef(tasks);
  const notifiedRef = useRef<Set<string>>(loadNotified());
  tasksRef.current = tasks;

  useEffect(() => {
    // 首次挂载申请一次通知权限（用户可能拒绝，拒绝后静默跳过）
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }

    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = Date.now();
      const notified = notifiedRef.current;
      const liveIds = new Set<string>();

      for (const t of tasksRef.current) {
        liveIds.add(t.id);
        if (t.status === 'completed' || !t.reminderAt) continue;
        if (t.reminderAt > now) continue; // 还没到提醒时间
        if (notified.has(t.id)) continue; // 已提醒过
        try {
          new Notification('⏰ 任务提醒', {
            body: t.name,
            tag: t.id,
            silent: false,
          });
          notified.add(t.id);
        } catch {
          /* 通知创建失败（极少数环境），跳过 */
        }
      }

      // 清理：仅保留仍存在于任务库中的已提醒 id，避免无限增长
      let changed = false;
      for (const id of [...notified]) {
        if (!liveIds.has(id)) {
          notified.delete(id);
          changed = true;
        }
      }
      if (changed || notified.size > 0) saveNotified(notified);
    };

    check();
    const id = setInterval(check, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);
}

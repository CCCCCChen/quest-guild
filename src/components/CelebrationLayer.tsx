// EXPORTS: CelebrationLayer
//
// 全局完成庆祝层：监听 useTasks.completeTask 派发的 window 事件 `quest:celebrate`，
// 渲染 confetti 粒子爆发 + 奖励卡牌翻面。视觉由 framer-motion 驱动，音效仍在
// completeTask 内由 sound.ts 播放（视觉与声音解耦）。任何入口完成任务都会触发。

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type CelebrateDetail = {
  taskName: string;
  difficulty: string;
  reputation: number;
  skillPoints: number;
  skillId?: string;
};

// RPG 主题色：金 / 紫 / 蓝 / 绿 / 红
const CONFETTI_COLORS = ['#f5c518', '#a855f7', '#3b82f6', '#22c55e', '#ef4444'];

export function CelebrationLayer() {
  const [celebration, setCelebration] = useState<CelebrateDetail | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CelebrateDetail>).detail;
      if (!detail) return;
      setCelebration(detail);
      setFlipKey((k) => k + 1); // 连续完成时强制重放动画
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCelebration(null), 2400);
    };
    window.addEventListener('quest:celebrate', handler as EventListener);
    return () => {
      window.removeEventListener('quest:celebrate', handler as EventListener);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      <AnimatePresence>
        {celebration && (
          <motion.div key={flipKey} className="absolute inset-0">
            {/* confetti 粒子爆发 */}
            {[...Array(30)].map((_, i) => {
              const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.6;
              const dist = 120 + Math.random() * 240;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist - 40;
              const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                  animate={{ x, y, opacity: 0, scale: 0.5, rotate: 360 }}
                  transition={{ duration: 1.1 + Math.random() * 0.4, ease: 'easeOut' }}
                  className="absolute left-1/2 top-[30%] h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              );
            })}

            {/* 奖励卡牌翻面 */}
            <div className="absolute left-1/2 top-[22%] -translate-x-1/2" style={{ perspective: 800 }}>
              <motion.div
                initial={{ rotateY: 90, opacity: 0, scale: 0.8 }}
                animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                className="rounded-2xl border border-primary/50 bg-card/95 px-6 py-4 text-center shadow-2xl shadow-primary/20 backdrop-blur"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">任务完成</div>
                <div className="mt-1 max-w-[200px] truncate text-sm font-bold text-foreground">
                  {celebration.taskName}
                </div>
                <div className="mt-3 flex items-center justify-center gap-5">
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-black tabular-nums text-primary">+{celebration.reputation}</span>
                    <span className="text-[10px] text-muted-foreground">声望</span>
                  </div>
                  {celebration.skillPoints > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-black tabular-nums text-accent">+{celebration.skillPoints}</span>
                      <span className="text-[10px] text-muted-foreground">能力点</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CelebrationLayer;

// P0-G：时间账面板
//
// 展示未完成任务的时间账：今日/本周/累计/逾期 预估分钟、DDL 倒排每日所需、
// 按生活领域与内容性质的分布。挂载于 Today 页 header 下方。

import { useMemo } from 'react';
import { Clock, CalendarClock, Layers, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTasks } from '@/hooks/useTasks';
import { computeTimeAccount, formatMinutes, type DimSlice } from '@/lib/timeAccount';

function StatTile({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={tone === 'danger' ? 'text-lg font-semibold text-destructive' : 'text-lg font-semibold'}>
        {value}
      </div>
    </div>
  );
}

function MiniBars({ title, slices }: { title: string; slices: DimSlice[] }) {
  if (slices.length === 0) return null;
  const max = Math.max(...slices.map((s) => s.minutes), 1);
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] text-muted-foreground">{title}</div>
      {slices.slice(0, 4).map((s) => (
        <div key={s.key} className="flex items-center gap-2">
          <span className="w-10 shrink-0 truncate text-[11px]">{s.label}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(6, (s.minutes / max) * 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
            {formatMinutes(s.minutes)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimeAccountPanel() {
  const { tasks } = useTasks();
  const summary = useMemo(() => computeTimeAccount(tasks), [tasks]);

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">时间账</CardTitle>
        {summary.ddlReverse && (
          <span className="flex items-center gap-1 text-[11px] text-warning">
            <CalendarClock className="h-3 w-3" />
            最早截止 {summary.ddlReverse.daysLeft} 天后 · 每天至少 {formatMinutes(summary.ddlReverse.perDay)}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile icon={<Clock className="h-3 w-3" />} label="今日待做" value={formatMinutes(summary.today)} />
          <StatTile icon={<CalendarClock className="h-3 w-3" />} label="本周待做" value={formatMinutes(summary.week)} />
          <StatTile icon={<Layers className="h-3 w-3" />} label="累计待做" value={formatMinutes(summary.total)} />
          <StatTile
            icon={<AlertTriangle className="h-3 w-3" />}
            label="已逾期"
            value={formatMinutes(summary.overdue)}
            tone={summary.overdue > 0 ? 'danger' : 'default'}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniBars title="按生活领域" slices={summary.byLifeDomain} />
          <MiniBars title="按内容性质" slices={summary.byContentType} />
        </div>
      </CardContent>
    </Card>
  );
}

export default TimeAccountPanel;

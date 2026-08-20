import { useMemo } from 'react';
import { motion } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Clock,
  CheckCircle2,
  Flame,
  Star,
  Target,
  TrendingUp,
  Award,
  Zap,
} from 'lucide-react';
import { useStats } from '@/hooks/useStats';
import { useTasks } from '@/hooks/useTasks';
import { useSkills } from '@/hooks/useSkills';
import { CHART_COLORS } from '@/lib/chart-colors';
import { formatDuration } from '@/lib/utils';

// 图表空状态遮罩：数据全 0 时显示提示，避免"一片空白"误以为坏掉
function ChartEmptyOverlay({ text = '暂无数据，完成任务后将自动生成' }: { text?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4">
      <p className="text-sm text-muted-foreground/70">{text}</p>
      <p className="text-[11px] text-muted-foreground/40">开始完成任务或专注计时即可点亮图表</p>
    </div>
  );
}

function isAllZero(arr: number[]): boolean {
  return arr.length > 0 && arr.every((v) => v === 0);
}

export default function StatsPage() {
  const {
    weeklyFocusMinutes,
    totalCompleted,
    streakDays,
    totalEarnedReputation,
    dailyCompletedCounts,
    dailyFocusMinutes,
    difficultyDistribution,
    completedTasks,
    skillGrowthTimeline,
    epicCompletedCount,
    dailyCompletedCount,
  } = useStats();

  const { skills, skillPoints } = useSkills();
  const unlockedSkills = skills.filter((s) => s.status !== 'locked');

  const kpiCards = useMemo(
    () => [
      {
        title: '本周专注时长',
        value: formatDuration(weeklyFocusMinutes * 60),
        subtitle: '累计专注时间',
        icon: Clock,
        color: 'text-primary',
        bgGlow: 'shadow-primary/20',
      },
      {
        title: '本周完成任务',
        value: totalCompleted.toString(),
        subtitle: '悬赏任务已交付',
        icon: CheckCircle2,
        color: 'text-success',
        bgGlow: 'shadow-success/20',
      },
      {
        title: '连续完成',
        value: `${streakDays} 天`,
        subtitle: '每日连胜纪录',
        icon: Flame,
        color: 'text-warning',
        bgGlow: 'shadow-warning/20',
      },
      {
        title: '累计声望',
        value: totalEarnedReputation.toLocaleString(),
        subtitle: '公会总积分',
        icon: Star,
        color: 'text-accent',
        bgGlow: 'shadow-accent/20',
      },
    ],
    [weeklyFocusMinutes, totalCompleted, streakDays, totalEarnedReputation],
  );

  const barChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 24, 35, 0.95)',
        borderColor: CHART_COLORS.primary,
        borderWidth: 1,
        textStyle: { color: '#d4c9a8' },
        axisPointer: { type: 'shadow' },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dailyCompletedCounts.map((d) => d.date.slice(5)),
        axisLine: { lineStyle: { color: 'rgba(232, 179, 74, 0.3)' } },
        axisLabel: { color: '#8a8472', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisLabel: { color: '#8a8472', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(232, 179, 74, 0.08)' } },
      },
      series: [
        {
          name: '完成任务数',
          type: 'bar',
          barWidth: '45%',
          data: dailyCompletedCounts.map((d) => d.count),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: CHART_COLORS.primary },
                { offset: 1, color: 'rgba(232, 179, 74, 0.2)' },
              ],
            },
            borderRadius: [4, 4, 0, 0],
            shadowColor: CHART_COLORS.primary,
            shadowBlur: 10,
          },
        },
      ],
    }),
    [dailyCompletedCounts],
  );

  const lineChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(20, 24, 35, 0.95)',
        borderColor: CHART_COLORS.accent,
        borderWidth: 1,
        textStyle: { color: '#d4c9a8' },
        formatter: (params: any) => {
          const p = params[0];
          return `${p.axisValue}<br/>专注时长: ${p.value} 分钟`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dailyFocusMinutes.map((d) => d.date.slice(5)),
        axisLine: { lineStyle: { color: 'rgba(155, 89, 230, 0.3)' } },
        axisLabel: { color: '#8a8472', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '分钟',
        nameTextStyle: { color: '#8a8472', fontSize: 11 },
        axisLine: { show: false },
        axisLabel: { color: '#8a8472', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(155, 89, 230, 0.08)' } },
      },
      series: [
        {
          name: '专注时长',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          data: dailyFocusMinutes.map((d) => d.minutes),
          lineStyle: { color: CHART_COLORS.accent, width: 2 },
          itemStyle: {
            color: CHART_COLORS.accent,
            borderColor: '#fff',
            borderWidth: 2,
            shadowColor: CHART_COLORS.accent,
            shadowBlur: 10,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(155, 89, 230, 0.35)' },
                { offset: 1, color: 'rgba(155, 89, 230, 0.02)' },
              ],
            },
          },
        },
      ],
    }),
    [dailyFocusMinutes],
  );

  const pieChartOption = useMemo(
    () => ({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(20, 24, 35, 0.95)',
        borderColor: CHART_COLORS.primary,
        borderWidth: 1,
        textStyle: { color: '#d4c9a8' },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: { color: '#a8a08c', fontSize: 12 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
      },
      series: [
        {
          name: '难度分布',
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: 'rgba(20, 24, 35, 0.8)',
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#d4c9a8',
            },
            itemStyle: {
              shadowBlur: 20,
              shadowOffsetX: 0,
              shadowColor: 'rgba(232, 179, 74, 0.5)',
            },
          },
          labelLine: { show: false },
          data: [
            {
              value: difficultyDistribution.easy,
              name: '简单',
              itemStyle: { color: CHART_COLORS.success },
            },
            {
              value: difficultyDistribution.normal,
              name: '普通',
              itemStyle: { color: CHART_COLORS.info },
            },
            {
              value: difficultyDistribution.hard,
              name: '困难',
              itemStyle: { color: CHART_COLORS.warning },
            },
            {
              value: difficultyDistribution.epic,
              name: '史诗',
              itemStyle: { color: CHART_COLORS.primary },
            },
          ],
        },
      ],
    }),
    [difficultyDistribution],
  );

  const recentCompleted = useMemo(() => {
    return [...completedTasks]
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 5);
  }, [completedTasks]);

  const difficultyLabel: Record<string, string> = {
    easy: '简单',
    normal: '普通',
    hard: '困难',
    epic: '史诗',
  };

  const difficultyColor: Record<string, string> = {
    easy: 'text-success',
    normal: 'text-info',
    hard: 'text-warning',
    epic: 'text-primary',
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-wide flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            统计面板
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            追踪你的冒险旅程与成长轨迹
          </p>
        </div>
      </motion.div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
            >
              <Card className="border-border/60 bg-card/60 backdrop-blur-sm hover:border-primary/40 transition-all duration-300">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground tracking-wider">
                        {card.title}
                      </p>
                      <p className={`text-3xl font-bold tabular-nums ${card.color}`}>
                        {card.value}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {card.subtitle}
                      </p>
                    </div>
                    <div
                      className={`p-2.5 rounded-lg bg-secondary/60 ${card.color} shadow-lg ${card.bgGlow}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 完成任务柱状图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                近 7 天完成任务
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <ReactECharts
                  option={barChartOption}
                  style={{ height: '280px' }}
                  opts={{ renderer: 'canvas' }}
                />
                {isAllZero(dailyCompletedCounts.map((d) => d.count)) && <ChartEmptyOverlay />}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 难度分布环形图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" />
                难度分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <ReactECharts
                  option={pieChartOption}
                  style={{ height: '280px' }}
                  opts={{ renderer: 'canvas' }}
                />
                {isAllZero(Object.values(difficultyDistribution)) && <ChartEmptyOverlay text="暂无已完成任务" />}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 专注时长趋势 + 能力成长 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 专注时长折线图 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                近 7 天专注时长趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <ReactECharts
                  option={lineChartOption}
                  style={{ height: '280px' }}
                  opts={{ renderer: 'canvas' }}
                />
                {isAllZero(dailyFocusMinutes.map((d) => d.minutes)) && (
                  <ChartEmptyOverlay text="近 7 天无专注记录" />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 能力成长概览 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                能力成长
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {unlockedSkills.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">已点亮能力</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                  <p className="text-2xl font-bold text-accent tabular-nums">
                    {skillPoints}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">可用能力点</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">最近完成</p>
                {recentCompleted.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground/60">
                    暂无完成记录
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentCompleted.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 rounded-md border border-border/30 bg-secondary/20 px-3 py-2"
                      >
                        <div
                          className={`size-2 rounded-full ${difficultyColor[task.difficulty]} bg-current`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {task.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            +{task.rewardReputation} 声望 · {difficultyLabel[task.difficulty]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 能力成长轨迹 + 完成概览 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                能力成长轨迹
              </CardTitle>
            </CardHeader>
            <CardContent>
              {skillGrowthTimeline.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground/60">
                  尚未点亮任何能力，完成任务积累经验即可解锁
                </div>
              ) : (
                <ol className="relative border-l border-border/40 ml-2 space-y-4">
                  {skillGrowthTimeline.map((s) => (
                    <li key={s.id} className="ml-4">
                      <div className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-primary" />
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.category} · {new Date(s.unlockedAt).toLocaleDateString()}
                        {s.status === 'enhanced' && ' · 已强化'}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
        >
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-accent" />
                完成概览
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-bold text-primary tabular-nums">{epicCompletedCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">史诗完成</p>
              </div>
              <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-bold text-accent tabular-nums">{dailyCompletedCount}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">每日完成</p>
              </div>
              <div className="col-span-2 rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                <p className="text-2xl font-bold text-success tabular-nums">{totalCompleted}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">累计完成任务</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

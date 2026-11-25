import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { formatDashboardUSD, formatUSDExact } from '../api';
import type { AnalyticsResponse, CalendarResponse, DailyPerformancePoint } from '../types';
import { CalendarView } from './CalendarView';

interface DashboardViewProps {
  year: number;
  month: number;
  calendarData: CalendarResponse | null;
  calendarLoading: boolean;
  analyticsData: AnalyticsResponse | null;
  analyticsLoading: boolean;
  accountBalance: number;
  showWeekly: boolean;
  onToggleWeekly: () => void;
  onChangeYear: (y: number) => void;
  onChangeMonth: (m: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onThisMonth: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate: string | null;
  onLoadDemo: () => void;
  onOpenSync: () => void;
}

function InfoBadge({ tooltip }: { tooltip: string }) {
  return (
    <span
      title={tooltip}
      className="inline-flex cursor-help items-center text-slate-500 transition hover:text-slate-300"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

/** Circular Donut Ring matching reference Win Rate card */
function WinRateDonut({ winrate }: { winrate: number }) {
  const clamped = Math.max(0, Math.min(100, winrate));
  const size = 54;
  const stroke = 5.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = clamped > 0 && clamped < 100 ? 6 : 0;
  const winLen = Math.max(0, (clamped / 100) * circ - gap);
  const lossLen = Math.max(0, ((100 - clamped) / 100) * circ - gap);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      {/* Subtle background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={stroke}
      />
      {/* Win arc (green) */}
      {winLen > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#22c55e"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${winLen} ${circ}`}
          strokeDashoffset={0}
        />
      )}
      {/* Loss arc (red) */}
      {lossLen > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f87171"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${lossLen} ${circ}`}
          strokeDashoffset={-(winLen + gap)}
        />
      )}
    </svg>
  );
}

/** Semi-circle Gauge matching reference Profit Factor card */
function ProfitFactorGauge({ pf }: { pf: number }) {
  const safePf = Math.max(0, pf);
  // Ratio of green vs red: PF=1 -> 50%, PF=2 -> 67%, PF=3 -> 75%, PF=0.5 -> 33%
  const greenFrac = safePf === 0 ? 0 : Math.min(0.92, Math.max(0.08, safePf / (safePf + 1)));
  const r = 24;
  const cx = 32;
  const cy = 30;
  const semiCirc = Math.PI * r;
  const gap = greenFrac > 0 && greenFrac < 1 ? 6 : 0;
  const greenLen = Math.max(0, greenFrac * semiCirc - gap / 2);
  const redLen = Math.max(0, (1 - greenFrac) * semiCirc - gap / 2);

  // Arc path from left (cx - r, cy) to right (cx + r, cy) over the top
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg width="64" height="38" viewBox="0 0 64 38" className="shrink-0 overflow-visible">
      <path
        d={arcPath}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {greenLen > 0 && (
        <path
          d={arcPath}
          fill="none"
          stroke="#22c55e"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${greenLen} ${semiCirc}`}
          strokeDashoffset={0}
        />
      )}
      {redLen > 0 && (
        <path
          d={arcPath}
          fill="none"
          stroke="#f87171"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${redLen} ${semiCirc}`}
          strokeDashoffset={-(greenLen + gap)}
        />
      )}
    </svg>
  );
}

function formatAxisUSD(val: number): string {
  const rounded = Math.round(val);
  if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString('en-US')}`;
  return `$${rounded.toLocaleString('en-US')}`;
}

function niceStep(range: number, targetTicks = 5): number {
  if (range <= 0) return 100;
  const raw = range / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm <= 1) return mag;
  if (norm <= 2) return 2 * mag;
  if (norm <= 2.5) return 2.5 * mag;
  if (norm <= 5) return 5 * mag;
  return 10 * mag;
}

function DashboardEquityChart({
  points,
  loading,
}: {
  points: { date: string; equity: number }[];
  loading: boolean;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    const w = 600;
    const h = 225;
    const padL = 56;
    const padR = 14;
    const padT = 14;
    const padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    if (points.length === 0) {
      return { w, h, padL, padR, padT, padB, plotW, plotH, coords: [], ticks: [], zeroY: padT + plotH / 2, lineD: '', areaD: '' };
    }

    const rawVals = [0, ...points.map((p) => p.equity)];
    const rawMin = Math.min(...rawVals);
    const rawMax = Math.max(...rawVals);
    const step = niceStep(Math.max(50, rawMax - rawMin), 6);
    const minV = Math.floor(rawMin / step) * step;
    const maxV = Math.ceil(rawMax / step) * step;
    const range = Math.max(step, maxV - minV);

    const ticks: number[] = [];
    for (let v = minV; v <= maxV + step * 0.01; v += step) {
      ticks.push(Math.round(v));
    }

    const coords = points.map((p, i) => {
      const x = padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
      const y = padT + ((maxV - p.equity) / range) * plotH;
      return { x, y, ...p };
    });

    const zeroY = padT + ((maxV - 0) / range) * plotH;
    const lineD = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const areaD =
      coords.length > 0
        ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`
        : '';

    return { w, h, padL, padR, padT, padB, plotW, plotH, coords, ticks, minV, maxV, range, zeroY, lineD, areaD };
  }, [points]);

  if (loading && points.length === 0) {
    return (
      <div className="flex h-[225px] items-center justify-center text-xs text-slate-500">
        Loading equity curve...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[225px] items-center justify-center text-xs text-slate-500">
        No trade history yet
      </div>
    );
  }

  const hovered = hoverIdx !== null ? chart.coords[hoverIdx] : null;
  const xLabelIndices = Array.from(
    new Set([0, Math.floor(chart.coords.length / 2), chart.coords.length - 1]),
  ).filter((idx) => chart.coords[idx]);

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        className="h-[225px] w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="dashEqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {chart.ticks.map((val) => {
          const y = chart.padT + (((chart.maxV ?? 0) - val) / (chart.range ?? 1)) * chart.plotH;
          const isZero = val === 0;
          return (
            <g key={val}>
              <line
                x1={chart.padL}
                x2={chart.w - chart.padR}
                y1={y}
                y2={y}
                stroke={isZero ? 'rgba(148,163,184,0.22)' : 'rgba(255,255,255,0.05)'}
                strokeDasharray={isZero ? undefined : '2 3'}
              />
              <text
                x={chart.padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {formatAxisUSD(val)}
              </text>
            </g>
          );
        })}

        {/* Area & Line */}
        <path d={chart.areaD} fill="url(#dashEqGrad)" />
        <path
          d={chart.lineD}
          fill="none"
          stroke="#818cf8"
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Hover crosshair & dot */}
        {hovered && (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={chart.padT}
              y2={chart.h - chart.padB}
              stroke="rgba(129,140,248,0.45)"
              strokeDasharray="3 3"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r="4"
              fill="#818cf8"
              stroke="#0b0c12"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Invisible interactive hit columns */}
        {chart.coords.map((c, idx) => {
          const prevX = idx === 0 ? chart.padL : (chart.coords[idx - 1].x + c.x) / 2;
          const nextX =
            idx === chart.coords.length - 1
              ? chart.w - chart.padR
              : (c.x + chart.coords[idx + 1].x) / 2;
          return (
            <rect
              key={c.date}
              x={prevX}
              y={chart.padT}
              width={Math.max(4, nextX - prevX)}
              height={chart.plotH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(idx)}
            />
          );
        })}

        {/* X axis date labels */}
        {xLabelIndices.map((idx) => {
          const c = chart.coords[idx];
          const anchor =
            idx === 0 ? 'start' : idx === chart.coords.length - 1 ? 'end' : 'middle';
          return (
            <text
              key={idx}
              x={c.x}
              y={chart.h - 8}
              textAnchor={anchor}
              fontSize="10"
              fill="#6b7280"
            >
              {c.date.replace(/-/g, '/')}
            </text>
          );
        })}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-2 right-3 rounded-lg border border-white/10 bg-[#181a28]/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-xs"
        >
          <div className="text-slate-400">{hovered.date.replace(/-/g, '/')}</div>
          <div
            className={`font-bold tabular-nums ${
              hovered.equity >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatUSDExact(hovered.equity)}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardDailyPerformanceChart({
  points,
  loading,
  onSelectDate,
}: {
  points: DailyPerformancePoint[];
  loading: boolean;
  onSelectDate: (dateStr: string) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chart = useMemo(() => {
    const w = 600;
    const h = 225;
    const padL = 56;
    const padR = 14;
    const padT = 14;
    const padB = 30;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    if (points.length === 0) {
      return { w, h, padL, padR, padT, padB, plotW, plotH, bars: [], ticks: [], zeroY: padT + plotH / 2 };
    }

    const rawVals = [0, ...points.map((p) => p.pnl)];
    const rawMin = Math.min(...rawVals);
    const rawMax = Math.max(...rawVals);
    const step = niceStep(Math.max(50, rawMax - rawMin), 6);
    const minV = Math.floor(rawMin / step) * step;
    const maxV = Math.ceil(rawMax / step) * step;
    const range = Math.max(step, maxV - minV);

    const ticks: number[] = [];
    for (let v = minV; v <= maxV + step * 0.01; v += step) {
      ticks.push(Math.round(v));
    }

    const zeroY = padT + ((maxV - 0) / range) * plotH;
    const slotW = plotW / Math.max(1, points.length);
    const barW = Math.min(18, Math.max(2.5, slotW * 0.62));

    const bars = points.map((p, i) => {
      const cx = padL + i * slotW + slotW / 2;
      const valY = padT + ((maxV - p.pnl) / range) * plotH;
      const top = Math.min(zeroY, valY);
      const height = Math.max(1.5, Math.abs(valY - zeroY));
      return {
        ...p,
        cx,
        x: cx - barW / 2,
        y: top,
        width: barW,
        height,
        slotX: padL + i * slotW,
        slotW,
      };
    });

    return { w, h, padL, padR, padT, padB, plotW, plotH, bars, ticks, minV, maxV, range, zeroY };
  }, [points]);

  if (loading && points.length === 0) {
    return (
      <div className="flex h-[225px] items-center justify-center text-xs text-slate-500">
        Loading daily performance...
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[225px] items-center justify-center text-xs text-slate-500">
        No daily performance data yet
      </div>
    );
  }

  const hovered = hoverIdx !== null ? chart.bars[hoverIdx] : null;
  const xLabelIndices = Array.from(
    new Set([0, Math.floor(chart.bars.length / 2), chart.bars.length - 1]),
  ).filter((idx) => chart.bars[idx]);

  return (
    <div className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${chart.w} ${chart.h}`}
        className="h-[225px] w-full"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal grid lines */}
        {chart.ticks.map((val) => {
          const y = chart.padT + (((chart.maxV ?? 0) - val) / (chart.range ?? 1)) * chart.plotH;
          const isZero = val === 0;
          return (
            <g key={val}>
              <line
                x1={chart.padL}
                x2={chart.w - chart.padR}
                y1={y}
                y2={y}
                stroke={isZero ? 'rgba(148,163,184,0.25)' : 'rgba(255,255,255,0.05)'}
                strokeDasharray={isZero ? undefined : '2 3'}
              />
              <text
                x={chart.padL - 8}
                y={y + 3.5}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {formatAxisUSD(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {chart.bars.map((b, idx) => {
          const isPos = b.pnl >= 0;
          const isHovered = hoverIdx === idx;
          return (
            <g
              key={b.date}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIdx(idx)}
              onClick={() => onSelectDate(b.date)}
            >
              <rect
                x={b.slotX}
                y={chart.padT}
                width={Math.max(4, b.slotW)}
                height={chart.plotH}
                fill={isHovered ? 'rgba(255,255,255,0.03)' : 'transparent'}
              />
              <rect
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                rx={Math.min(2.5, b.width / 2)}
                fill={
                  isPos
                    ? isHovered
                      ? '#4ade80'
                      : '#22c55e'
                    : isHovered
                      ? '#fb7185'
                      : '#ef4444'
                }
                opacity={isHovered ? 1 : 0.9}
              />
            </g>
          );
        })}

        {/* X axis date labels */}
        {xLabelIndices.map((idx) => {
          const b = chart.bars[idx];
          const anchor =
            idx === 0 ? 'start' : idx === chart.bars.length - 1 ? 'end' : 'middle';
          return (
            <text
              key={idx}
              x={b.cx}
              y={chart.h - 8}
              textAnchor={anchor}
              fontSize="10"
              fill="#6b7280"
            >
              {b.date.replace(/-/g, '/')}
            </text>
          );
        })}
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute top-2 right-3 rounded-lg border border-white/10 bg-[#181a28]/95 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-xs">
          <div className="text-slate-400">
            {hovered.date.replace(/-/g, '/')} · {hovered.trades} trades
          </div>
          <div
            className={`font-bold tabular-nums ${
              hovered.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatUSDExact(hovered.pnl)}
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardView({
  year,
  month,
  calendarData,
  calendarLoading,
  analyticsData,
  analyticsLoading,
  accountBalance,
  showWeekly,
  onToggleWeekly,
  onChangeYear,
  onChangeMonth,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  onSelectDate,
  selectedDate,
  onLoadDemo,
  onOpenSync,
}: DashboardViewProps) {
  const k = analyticsData?.kpis;
  const netProfit = k?.net_profit ?? 0;
  const winrate = k?.winrate ?? 0;
  const profitFactor = k?.profit_factor ?? 0;
  const expectancyUsd = k?.expectancy_usd ?? 0;
  const expectancyR = k?.expectancy_r ?? null;

  const winRateDisplay = Number.isInteger(winrate) ? `${winrate}%` : `${winrate.toFixed(1)}%`;

  return (
    <div className="space-y-4">
      {/* Row 1: 4 Top KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Net P&L */}
        <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#12131c] px-5 py-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span>Total Net P&amp;L</span>
            <InfoBadge tooltip="Tổng lợi nhuận ròng sau commission & swap trên tất cả các lệnh đã đóng" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums sm:text-[26px] ${
                netProfit > 0
                  ? 'text-[#34d399]'
                  : netProfit < 0
                    ? 'text-[#f87171]'
                    : 'text-slate-200'
              }`}
            >
              {formatDashboardUSD(netProfit)}
            </div>
            {k && k.total_trades > 0 && (
              <span className="text-[11px] font-medium text-slate-500">
                {k.total_trades} trades
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Win Rate + Donut Ring */}
        <div className="flex min-h-[104px] items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#12131c] px-5 py-4">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <span>Win Rate</span>
              <InfoBadge
                tooltip={`Tỷ lệ lệnh thắng (${k?.wins ?? 0} thắng / ${k?.losses ?? 0} thua)`}
              />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums sm:text-[26px]">
              {winRateDisplay}
            </div>
          </div>
          <WinRateDonut winrate={winrate} />
        </div>

        {/* Card 3: Profit Factor + Semi-circle Gauge */}
        <div className="flex min-h-[104px] items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#12131c] px-5 py-4">
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <span>Profit Factor</span>
              <InfoBadge tooltip="Tổng lãi gộp chia tổng lỗ gộp (> 1.0 là có lợi nhuận dương)" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums sm:text-[26px]">
              {profitFactor.toFixed(2)}
            </div>
          </div>
          <ProfitFactorGauge pf={profitFactor} />
        </div>

        {/* Card 4: Per-Trade Expectancy */}
        <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/[0.07] bg-[#12131c] px-5 py-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span>Per-Trade Expectancy</span>
            <InfoBadge
              tooltip={`Lợi nhuận kỳ vọng trung bình mỗi lệnh. Avg Win: ${formatUSDExact(k?.avg_win ?? 0)} / Avg Loss: ${formatUSDExact(k?.avg_loss ?? 0)}`}
            />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div
              className={`text-2xl font-bold tracking-tight tabular-nums sm:text-[26px] ${
                expectancyUsd > 0
                  ? 'text-[#34d399]'
                  : expectancyUsd < 0
                    ? 'text-[#f87171]'
                    : 'text-slate-200'
              }`}
            >
              {formatDashboardUSD(expectancyUsd)}
            </div>
            {expectancyR !== null && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  expectancyR >= 0
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-400'
                }`}
              >
                {expectancyR >= 0 ? `+${expectancyR}R` : `${expectancyR}R`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Equity Curve + Daily Performance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
              <span>Equity Curve</span>
              <InfoBadge tooltip="Đường tăng trưởng lợi nhuận tích lũy theo từng ngày giao dịch" />
            </div>
            {k && k.max_drawdown > 0 && (
              <span className="text-[11px] font-medium text-slate-500">
                Max DD: <span className="text-rose-400">-${k.max_drawdown.toLocaleString()}</span>
              </span>
            )}
          </div>
          <DashboardEquityChart
            points={analyticsData?.equity_curve ?? []}
            loading={analyticsLoading}
          />
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
              <span>Daily Performance</span>
              <InfoBadge tooltip="Biểu đồ P&L từng ngày (bấm vào từng cột để xem chi tiết lệnh trong ngày)" />
            </div>
            <span className="text-[11px] text-slate-500">Click bar to view day</span>
          </div>
          <DashboardDailyPerformanceChart
            points={analyticsData?.daily_performance ?? []}
            loading={analyticsLoading}
            onSelectDate={onSelectDate}
          />
        </div>
      </div>

      {/* Row 3: Monthly Calendar */}
      <CalendarView
        year={year}
        month={month}
        data={calendarData}
        loading={calendarLoading}
        accountBalance={accountBalance}
        showWeekly={showWeekly}
        onToggleWeekly={onToggleWeekly}
        onChangeYear={onChangeYear}
        onChangeMonth={onChangeMonth}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onThisMonth={onThisMonth}
        onSelectDate={onSelectDate}
        selectedDate={selectedDate}
        onLoadDemo={onLoadDemo}
        onOpenSync={onOpenSync}
      />
    </div>
  );
}

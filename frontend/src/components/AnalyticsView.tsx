import {
  Activity,
  AlertTriangle,
  Award,
  Flame,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatUSDExact } from '../api';
import type { AnalyticsGroupItem, AnalyticsResponse } from '../types';

interface AnalyticsViewProps {
  data: AnalyticsResponse | null;
  loading: boolean;
}

function EquityCurveChart({ points }: { points: { date: string; equity: number }[] }) {
  if (points.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-xs text-slate-500">
        Chưa đủ dữ liệu để vẽ đường Equity Curve
      </div>
    );
  }

  const w = 720;
  const h = 210;
  const padL = 58;
  const padR = 16;
  const padT = 16;
  const padB = 28;

  const vals = [0, ...points.map((p) => p.equity)];
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = Math.max(1, maxV - minV);

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const coords = points.map((p, i) => {
    const x = padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = padT + ((maxV - p.equity) / range) * plotH;
    return { x, y, ...p };
  });

  const zeroY = padT + ((maxV - 0) / range) * plotH;
  const lineD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const strokeColor = '#818cf8';

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full min-w-[420px]">
        <defs>
          <linearGradient id="eqGradDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const val = maxV - frac * range;
          const y = padT + frac * plotH;
          return (
            <g key={frac}>
              <line
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="3 3"
              />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#6b7280">
                {val < 0 ? `-$${Math.abs(Math.round(val)).toLocaleString()}` : `$${Math.round(val).toLocaleString()}`}
              </text>
            </g>
          );
        })}

        {/* Zero line */}
        <line x1={padL} x2={w - padR} y1={zeroY} y2={zeroY} stroke="rgba(148,163,184,0.28)" strokeWidth="1" />

        {/* Area & Line */}
        <path d={areaD} fill="url(#eqGradDark)" />
        <path d={lineD} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinejoin="round" />

        {/* Data dots */}
        {coords.map((c) => (
          <g key={c.date}>
            <circle cx={c.x} cy={c.y} r="3" fill={strokeColor} stroke="#12131c" strokeWidth="1.5">
              <title>
                {c.date}: {formatUSDExact(c.equity)}
              </title>
            </circle>
          </g>
        ))}

        {/* X labels (first, middle, last) */}
        {[0, Math.floor(coords.length / 2), coords.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i && coords[v])
          .map((idx) => (
            <text
              key={idx}
              x={coords[idx].x}
              y={h - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {coords[idx].date.replace(/-/g, '/')}
            </text>
          ))}
      </svg>
    </div>
  );
}

function GroupBarTable({
  title,
  subtitle,
  items,
  emptyText = 'Chưa có dữ liệu',
}: {
  title: string;
  subtitle?: string;
  items: AnalyticsGroupItem[];
  emptyText?: string;
}) {
  const maxAbs = Math.max(1, ...items.map((i) => Math.abs(i.net_profit)));
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const pct = Math.min(100, (Math.abs(item.net_profit) / maxAbs) * 100);
            const pos = item.net_profit >= 0;
            return (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">{item.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.trades} lệnh · WR {item.winrate}%
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums ${pos ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                    {formatUSDExact(item.net_profit)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${pos ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AnalyticsView({ data, loading }: AnalyticsViewProps) {
  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-12 text-center text-sm text-slate-500">
        Đang tính toán báo cáo phân tích...
      </div>
    );
  }

  const k = data.kpis;
  if (k.total_trades === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-[#12131c] p-12 text-center">
        <Activity className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-2 text-sm font-semibold text-slate-200">Chưa có dữ liệu lệnh để phân tích</p>
        <p className="mt-1 text-xs text-slate-500">Hãy Sync MT5, Import báo cáo hoặc nạp dữ liệu mẫu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Net P&amp;L</span>
          <div
            className={`mt-1 text-xl font-extrabold tabular-nums ${
              k.net_profit >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'
            }`}
          >
            {formatUSDExact(k.net_profit)}
          </div>
          <span className="text-[11px] text-slate-500">{k.total_trades} lệnh đóng</span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Winrate</span>
          <div className="mt-1 text-xl font-extrabold text-white tabular-nums">{k.winrate}%</div>
          <span className="text-[11px] text-slate-500">
            {k.wins ?? 0}W / {k.losses ?? 0}L
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Profit Factor</span>
          <div className="mt-1 text-xl font-extrabold text-white tabular-nums">{k.profit_factor}</div>
          <span className="text-[11px] text-slate-500">
            Kỳ vọng: {formatUSDExact(k.expectancy_usd)}/lệnh
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Avg Win / Avg Loss</span>
          <div className="mt-1 flex items-baseline gap-1.5 text-sm font-bold tabular-nums">
            <span className="text-[#34d399]">{formatUSDExact(k.avg_win)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#f87171]">{formatUSDExact(k.avg_loss)}</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Expectancy R: {k.expectancy_r !== null ? `${k.expectancy_r >= 0 ? '+' : ''}${k.expectancy_r}R` : '—'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Avg MFE / MAE</span>
          <div className="mt-1 flex items-baseline gap-1.5 text-base font-extrabold tabular-nums">
            <span className="text-emerald-400">
              {k.avg_mfe_r !== null ? `+${k.avg_mfe_r}R` : '—'}
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-rose-400">{k.avg_mae_r !== null ? `${k.avg_mae_r}R` : '—'}</span>
          </div>
          <span className="text-[11px] text-slate-500">Max DD: -${k.max_drawdown.toLocaleString()}</span>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
          <span className="text-[11px] font-semibold text-slate-400">Kỷ luật &amp; Ghi chú</span>
          <div className="mt-1 text-xl font-extrabold text-amber-400 tabular-nums">
            {k.avg_rating > 0 ? `${k.avg_rating} ★` : '—'}
          </div>
          <span className="text-[11px] text-slate-500">Đã ghi chú: {k.journaled_pct}% lệnh</span>
        </div>
      </div>

      {/* Equity Curve + Streaks / Rule Guardian */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-5 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-100">Đường tăng trưởng vốn (Equity Curve)</h3>
              <p className="text-xs text-slate-500">Tổng hợp P&amp;L tích lũy theo từng ngày giao dịch</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-[#34d399]">
                <TrendingUp className="h-3.5 w-3.5" /> Best: {formatUSDExact(k.best_trade)}
              </span>
              <span className="flex items-center gap-1 font-medium text-[#f87171]">
                <TrendingDown className="h-3.5 w-3.5" /> Worst: {formatUSDExact(k.worst_trade)}
              </span>
            </div>
          </div>
          <EquityCurveChart points={data.equity_curve} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          {/* Streaks */}
          <div className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-100">
              <Flame className="h-4 w-4 text-orange-400" />
              Chuỗi thắng / thua &amp; Hiệu suất
            </h3>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <div className="text-2xl font-extrabold text-[#34d399] tabular-nums">{k.max_win_streak}</div>
                <div className="text-[11px] font-medium text-emerald-300/80">Chuỗi thắng dài nhất</div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <div className="text-2xl font-extrabold text-[#f87171] tabular-nums">{k.max_loss_streak}</div>
                <div className="text-[11px] font-medium text-rose-300/80">Chuỗi thua dài nhất</div>
              </div>
            </div>
          </div>

          {/* Rule Guardian */}
          <div className="flex-1 rounded-2xl border border-white/[0.07] bg-[#12131c] p-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-100">
              {data.rule_violations.length === 0 ? (
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              Rule Guardian (Cảnh báo kỷ luật)
            </h3>
            {data.rule_violations.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                Tuyệt vời! Chưa phát hiện ngày nào vi phạm giới hạn lỗ ngày hoặc Overtrading.
              </div>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {data.rule_violations.map((v, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-200"
                  >
                    <span className="font-bold text-amber-300">{v.date.split('-').reverse().join('/')}:</span>{' '}
                    {v.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown Grid: Session, Weekday, Symbol */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GroupBarTable
          title="Hiệu suất theo Phiên (Session)"
          subtitle="Phát hiện khung giờ vàng kiếm tiền của bạn"
          items={data.by_session}
        />
        <GroupBarTable
          title="Hiệu suất theo Thứ trong tuần"
          subtitle="Ngày nào trong tuần bạn giao dịch tốt nhất"
          items={data.by_weekday}
        />
        <GroupBarTable
          title="Hiệu suất theo Symbol"
          subtitle="Cặp tiền / sản phẩm mang lại lợi nhuận chính"
          items={data.by_symbol}
        />
      </div>

      {/* Tag Analytics: Setups, Cost of Mistakes, Emotions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GroupBarTable
          title="Hiệu suất theo Setup / Chiến lược"
          subtitle="Chiến lược nào có tỷ lệ thắng & lợi nhuận cao nhất"
          items={data.by_setup}
          emptyText="Hãy gắn tag Setup cho các lệnh để xem thống kê"
        />
        <GroupBarTable
          title="Chi phí lỗi sai (Cost of Mistakes)"
          subtitle="Mỗi lỗi tâm lý/kỷ luật đang làm bạn mất bao nhiêu tiền"
          items={data.by_mistake}
          emptyText="Chưa có lệnh nào gắn tag Lỗi sai"
        />
        <GroupBarTable
          title="Tác động của Tâm lý giao dịch"
          subtitle="Mối liên hệ giữa cảm xúc và kết quả P&L"
          items={data.by_emotion}
          emptyText="Hãy gắn tag Tâm lý khi ghi chú lệnh"
        />
      </div>

      {/* MFE / MAE Coaching Note */}
      {k.avg_mfe_r !== null && k.expectancy_r !== null && (
        <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-4 text-xs text-indigo-100">
          <Award className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
          <div>
            <div className="font-bold text-indigo-200">Gợi ý tối ưu từ dữ liệu MFE / MAE</div>
            <p className="mt-0.5 text-indigo-200/80">
              Trung bình các lệnh của bạn đạt độ chạy tối đa <strong className="text-white">+{k.avg_mfe_r}R</strong> (MFE) và chịu drawdown trung bình{' '}
              <strong className="text-white">{k.avg_mae_r}R</strong> (MAE), trong khi kỳ vọng thực nhận là{' '}
              <strong className="text-white">{k.expectancy_r >= 0 ? `+${k.expectancy_r}R` : `${k.expectancy_r}R`}</strong>.
              {k.avg_mfe_r - k.expectancy_r > 0.5
                ? ' Khoảng cách giữa MFE và R thực nhận khá lớn — bạn có thể thử trailing stop theo cấu trúc M5 để giữ lệnh ăn trọn sóng hơn.'
                : ' Khả năng tối ưu điểm chốt lời của bạn đang rất sát với biên độ chạy thực tế của thị trường.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

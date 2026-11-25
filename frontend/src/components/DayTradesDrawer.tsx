import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkCheck,
  BookOpen,
  CandlestickChart,
  Check,
  Clock,
  NotebookPen,
  Star,
  X,
} from 'lucide-react';
import { api, formatDuration, formatPrice, formatTimeVN, formatUSDExact } from '../api';
import type { DailyJournal, Trade } from '../types';

interface DayTradesDrawerProps {
  dateStr: string | null;
  account: string;
  symbol: string;
  onClose: () => void;
  onSelectTrade: (trade: Trade, dayTrades: Trade[]) => void;
  onJournalSaved: () => void;
}

const MOOD_OPTIONS = [
  'Tập trung & Bình tĩnh',
  'Tự tin & Kỷ luật',
  'Hơi hồi hộp',
  'FOMO / Nóng vội',
  'Cay cú / Mất bình tĩnh',
  'Mệt mỏi',
];

export function DayTradesDrawer({
  dateStr,
  account,
  symbol,
  onClose,
  onSelectTrade,
  onJournalSaved,
}: DayTradesDrawerProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'trades' | 'journal'>('trades');

  const [journal, setJournal] = useState<DailyJournal>({
    date: dateStr || '',
    mood: '',
    summary: '',
    lessons: '',
    plan_tomorrow: '',
    rating: 0,
  });
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (!dateStr) return;
    setLoading(true);
    Promise.all([
      api.trades({ date: dateStr, account, symbol }),
      api.getDailyJournal(dateStr),
    ])
      .then(([tRes, jRes]) => {
        setTrades(tRes.trades);
        setJournal(jRes);
      })
      .finally(() => setLoading(false));
  }, [dateStr, account, symbol]);

  if (!dateStr) return null;

  const totalPnl = trades.reduce((acc, t) => acc + t.net_profit, 0);
  const wins = trades.filter((t) => t.net_profit > 0).length;
  const displayDate = dateStr.split('-').reverse().join('/');

  const handleSaveJournal = async () => {
    setSaving(true);
    try {
      await api.saveDailyJournal(dateStr, {
        mood: journal.mood,
        summary: journal.summary,
        lessons: journal.lessons,
        plan_tomorrow: journal.plan_tomorrow,
        rating: journal.rating,
      });
      setSavedToast(true);
      onJournalSaved();
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-white/[0.08] bg-[#11131d] text-slate-100 shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-white">Ngày {displayDate}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm font-bold tabular-nums ${
                  totalPnl > 0
                    ? 'bg-emerald-500/15 text-[#34d399]'
                    : totalPnl < 0
                      ? 'bg-rose-500/15 text-[#f87171]'
                      : 'bg-white/[0.07] text-slate-400'
                }`}
              >
                {formatUSDExact(totalPnl)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {trades.length} lệnh · {wins} thắng / {trades.length - wins} thua · Click vào từng lệnh để xem Chart Replay
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-white/[0.07] px-5">
          <button
            onClick={() => setTab('trades')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'trades'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CandlestickChart className="h-4 w-4" />
            Danh sách lệnh ({trades.length})
          </button>
          <button
            onClick={() => setTab('journal')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'journal'
                ? 'border-indigo-400 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Nhật ký tổng kết ngày
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'trades' ? (
            loading ? (
              <div className="py-12 text-center text-sm text-slate-500">Đang tải danh sách lệnh...</div>
            ) : trades.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-[#161825] p-8 text-center">
                <p className="text-sm font-medium text-slate-300">Không có lệnh giao dịch nào trong ngày này.</p>
                <button
                  onClick={() => setTab('journal')}
                  className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Viết nhật ký ngày nghỉ / quan sát
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {trades.map((trade) => {
                  const isWin = trade.net_profit >= 0;
                  return (
                    <div
                      key={trade.id}
                      onClick={() => onSelectTrade(trade, trades)}
                      className="group cursor-pointer rounded-xl border border-white/[0.07] bg-[#161825] p-3.5 transition-all hover:border-indigo-500/40 hover:bg-[#1a1d2d]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              trade.direction === 'LONG'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {trade.direction === 'LONG' ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {trade.direction}
                          </span>
                          <span className="text-sm font-bold text-white">{trade.symbol}</span>
                          <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                            {trade.volume} lot
                          </span>
                          <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            {trade.session}
                          </span>
                          {trade.is_playbook && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                              <BookmarkCheck className="h-3 w-3" /> A+
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-sm font-extrabold tabular-nums ${
                              isWin ? 'text-[#34d399]' : 'text-[#f87171]'
                            }`}
                          >
                            {formatUSDExact(trade.net_profit)}
                          </div>
                          {trade.r_multiple !== null && (
                            <div
                              className={`text-[11px] font-semibold tabular-nums ${
                                trade.r_multiple >= 0 ? 'text-emerald-400/85' : 'text-rose-400/85'
                              }`}
                            >
                              {trade.r_multiple >= 0 ? `+${trade.r_multiple}R` : `${trade.r_multiple}R`}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span>
                            Entry: <strong className="text-slate-200">{formatPrice(trade.entry_price, trade.symbol)}</strong>
                          </span>
                          <span>→</span>
                          <span>
                            Exit: <strong className="text-slate-200">{formatPrice(trade.exit_price, trade.symbol)}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatTimeVN(trade.entry_time)} – {formatTimeVN(trade.exit_time)} ({formatDuration(trade.entry_time, trade.exit_time)})
                          </span>
                        </div>
                      </div>

                      {/* MFE / MAE + Tags + Journal preview */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {trade.setup_tags.map((tg) => (
                            <span key={tg} className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                              {tg}
                            </span>
                          ))}
                          {trade.mistake_tags.map((tg) => (
                            <span key={tg} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                              {tg}
                            </span>
                          ))}
                          {!trade.has_journal && (
                            <span className="text-[11px] italic text-slate-500">Chưa có ghi chú — bấm để review</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {trade.has_journal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                              <NotebookPen className="h-3 w-3" /> Đã ghi chú
                            </span>
                          )}
                          <span className="rounded-md bg-indigo-600/90 px-2 py-0.5 text-[11px] font-semibold text-white transition group-hover:bg-indigo-500">
                            Xem Chart →
                          </span>
                        </div>
                      </div>

                      {trade.lesson_note && (
                        <p className="mt-2 line-clamp-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                          <strong className="text-amber-300">Bài học:</strong> {trade.lesson_note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Tâm trạng &amp; Năng lượng trong ngày
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setJournal({ ...journal, mood: m })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        journal.mood === m
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-white/[0.08] bg-[#161825] text-slate-300 hover:bg-[#1e2133]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Điểm kỷ luật trong ngày (1–5 sao)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setJournal({ ...journal, rating: n })}
                      className="p-1"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          n <= journal.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Tổng kết diễn biến ngày giao dịch
                </label>
                <textarea
                  rows={3}
                  value={journal.summary}
                  onChange={(e) => setJournal({ ...journal, summary: e.target.value })}
                  placeholder="Hôm nay thị trường chạy như thế nào? Mình có tuân thủ kế hoạch phiên không?"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#161825] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Bài học rút ra trong ngày
                </label>
                <textarea
                  rows={3}
                  value={journal.lessons}
                  onChange={(e) => setJournal({ ...journal, lessons: e.target.value })}
                  placeholder="Điều gì làm tốt cần phát huy? Sai lầm nào cần tuyệt đối tránh?"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#161825] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Lưu ý &amp; Kế hoạch cho ngày mai
                </label>
                <textarea
                  rows={3}
                  value={journal.plan_tomorrow}
                  onChange={(e) => setJournal({ ...journal, plan_tomorrow: e.target.value })}
                  placeholder="Khối lượng dự kiến, khung giờ tập trung, vùng giá cần theo dõi..."
                  className="w-full rounded-xl border border-white/[0.08] bg-[#161825] p-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveJournal}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
              >
                {savedToast ? (
                  <>
                    <Check className="h-4 w-4 text-white" />
                    Đã lưu nhật ký ngày!
                  </>
                ) : saving ? (
                  'Đang lưu...'
                ) : (
                  'Lưu nhật ký ngày'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

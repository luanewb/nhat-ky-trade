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
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-[2px]">
      <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold text-slate-900">Ngày {displayDate}</h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${
                  totalPnl > 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : totalPnl < 0
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {formatUSDExact(totalPnl)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {trades.length} lệnh · {wins} thắng / {trades.length - wins} thua · Click vào từng lệnh để xem Chart Replay
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-200 px-5">
          <button
            onClick={() => setTab('trades')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'trades'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CandlestickChart className="h-4 w-4" />
            Danh sách lệnh ({trades.length})
          </button>
          <button
            onClick={() => setTab('journal')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition ${
              tab === 'journal'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
              <div className="py-12 text-center text-sm text-slate-400">Đang tải danh sách lệnh...</div>
            ) : trades.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-medium text-slate-600">Không có lệnh giao dịch nào trong ngày này.</p>
                <button
                  onClick={() => setTab('journal')}
                  className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
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
                      className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:border-slate-400 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              trade.direction === 'LONG'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {trade.direction === 'LONG' ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            {trade.direction}
                          </span>
                          <span className="text-sm font-bold text-slate-900">{trade.symbol}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {trade.volume} lot
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            {trade.session}
                          </span>
                          {trade.is_playbook && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              <BookmarkCheck className="h-3 w-3" /> A+
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <div
                            className={`text-sm font-extrabold ${
                              isWin ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {formatUSDExact(trade.net_profit)}
                          </div>
                          {trade.r_multiple !== null && (
                            <div
                              className={`text-[11px] font-semibold ${
                                trade.r_multiple >= 0 ? 'text-emerald-600' : 'text-rose-500'
                              }`}
                            >
                              {trade.r_multiple >= 0 ? `+${trade.r_multiple}R` : `${trade.r_multiple}R`}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span>Entry: <strong className="text-slate-700">{formatPrice(trade.entry_price, trade.symbol)}</strong></span>
                          <span>→</span>
                          <span>Exit: <strong className="text-slate-700">{formatPrice(trade.exit_price, trade.symbol)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatTimeVN(trade.entry_time)} – {formatTimeVN(trade.exit_time)} ({formatDuration(trade.entry_time, trade.exit_time)})
                          </span>
                        </div>
                      </div>

                      {/* MFE / MAE + Tags + Journal preview */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {trade.setup_tags.map((tg) => (
                            <span key={tg} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              {tg}
                            </span>
                          ))}
                          {trade.mistake_tags.map((tg) => (
                            <span key={tg} className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                              {tg}
                            </span>
                          ))}
                          {!trade.has_journal && (
                            <span className="text-[11px] italic text-slate-400">Chưa có ghi chú — bấm để review</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {trade.has_journal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                              <NotebookPen className="h-3 w-3" /> Đã ghi chú
                            </span>
                          )}
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white opacity-90 transition group-hover:opacity-100">
                            Xem Chart →
                          </span>
                        </div>
                      </div>

                      {trade.lesson_note && (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-900">
                          <strong>Bài học:</strong> {trade.lesson_note}
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
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Tâm trạng & Năng lượng trong ngày
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setJournal({ ...journal, mood: m })}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        journal.mood === m
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
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
                          n <= journal.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Tổng kết diễn biến ngày giao dịch
                </label>
                <textarea
                  rows={3}
                  value={journal.summary}
                  onChange={(e) => setJournal({ ...journal, summary: e.target.value })}
                  placeholder="Hôm nay thị trường chạy như thế nào? Mình có tuân thủ kế hoạch phiên không?"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Bài học rút ra trong ngày
                </label>
                <textarea
                  rows={3}
                  value={journal.lessons}
                  onChange={(e) => setJournal({ ...journal, lessons: e.target.value })}
                  placeholder="Điều gì làm tốt cần phát huy? Sai lầm nào cần tuyệt đối tránh?"
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Lưu ý & Kế hoạch cho ngày mai
                </label>
                <textarea
                  rows={3}
                  value={journal.plan_tomorrow}
                  onChange={(e) => setJournal({ ...journal, plan_tomorrow: e.target.value })}
                  placeholder="Khối lượng dự kiến, khung giờ tập trung, vùng giá cần theo dõi..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <button
                onClick={handleSaveJournal}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {savedToast ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
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

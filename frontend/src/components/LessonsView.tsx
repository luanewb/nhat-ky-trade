import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookmarkCheck,
  BookOpen,
  CandlestickChart,
  Lightbulb,
  Search,
  Star,
} from 'lucide-react';
import { api, formatTimeVN, formatUSDExact } from '../api';
import type { DailyJournal, Trade } from '../types';

interface LessonsViewProps {
  onSelectTrade: (trade: Trade, list: Trade[]) => void;
}

export function LessonsView({ onSelectTrade }: LessonsViewProps) {
  const [search, setSearch] = useState('');
  const [playbookOnly, setPlaybookOnly] = useState(false);
  const [tradeLessons, setTradeLessons] = useState<Trade[]>([]);
  const [dailyLessons, setDailyLessons] = useState<DailyJournal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .lessons({ search: search.trim() || undefined, playbook_only: playbookOnly })
        .then((res) => {
          setTradeLessons(res.trade_lessons);
          setDailyLessons(res.daily_lessons);
        })
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [search, playbookOnly]);

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-100">
            <Lightbulb className="h-5 w-5 text-amber-400" />
            Thư viện Bài học, Lưu ý &amp; A+ Playbook
          </h2>
          <p className="text-xs text-slate-500">
            Ôn lại các bài học xương máu và các setup chuẩn mực trước mỗi phiên giao dịch mới
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bài học, lỗi sai, symbol..."
              className="w-60 rounded-xl border border-white/[0.08] bg-[#171925] py-1.5 pr-3 pl-8 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setPlaybookOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              playbookOnly
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : 'border-white/[0.08] bg-[#171925] text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookmarkCheck className="h-4 w-4" />
            Chỉ xem A+ Playbook
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Đang tải thư viện bài học...</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Trade Lessons Column */}
          <div className="space-y-3 lg:col-span-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bài học theo từng lệnh ({tradeLessons.length})
            </h3>
            {tradeLessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#12131c] p-10 text-center text-xs text-slate-500">
                Chưa có lệnh nào được ghi chú bài học hoặc khớp bộ lọc.
              </div>
            ) : (
              tradeLessons.map((trade) => {
                const isWin = trade.net_profit >= 0;
                return (
                  <div
                    key={trade.id}
                    className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4 transition hover:border-white/[0.15]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                        <span className="text-sm font-bold text-slate-100">{trade.symbol}</span>
                        <span className="text-xs text-slate-500">{formatTimeVN(trade.entry_time, true)}</span>
                        {trade.is_playbook && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                            <BookmarkCheck className="h-3 w-3" /> A+ Playbook
                          </span>
                        )}
                        {trade.rating > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-400">
                            <Star className="h-3.5 w-3.5 fill-amber-400" /> {trade.rating}/5
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`text-sm font-extrabold tabular-nums ${
                            isWin ? 'text-[#34d399]' : 'text-[#f87171]'
                          }`}
                        >
                          {formatUSDExact(trade.net_profit)}
                          {trade.r_multiple !== null && (
                            <span className="ml-1 text-xs font-semibold">
                              ({trade.r_multiple >= 0 ? `+${trade.r_multiple}R` : `${trade.r_multiple}R`})
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => onSelectTrade(trade, tradeLessons)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1e2130] px-2.5 py-1 text-xs font-semibold text-slate-100 transition hover:bg-[#282c40]"
                        >
                          <CandlestickChart className="h-3.5 w-3.5" />
                          Xem Chart
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-xs">
                      {trade.lesson_note && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100">
                          <span className="font-bold text-amber-300">★ Bài học rút ra: </span>
                          {trade.lesson_note}
                        </div>
                      )}
                      {trade.action_note && (
                        <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-sky-100">
                          <span className="font-bold text-sky-300">→ Lưu ý lần sau: </span>
                          {trade.action_note}
                        </div>
                      )}
                      {trade.setup_note && (
                        <p className="text-slate-400">
                          <strong className="text-slate-200">Setup:</strong> {trade.setup_note}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    {(trade.setup_tags.length > 0 || trade.mistake_tags.length > 0 || trade.emotion_tags.length > 0) && (
                      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/[0.06] pt-2.5">
                        {trade.setup_tags.map((t) => (
                          <span key={t} className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                            {t}
                          </span>
                        ))}
                        {trade.emotion_tags.map((t) => (
                          <span key={t} className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                            {t}
                          </span>
                        ))}
                        {trade.mistake_tags.map((t) => (
                          <span key={t} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Daily Review Lessons Column */}
          <div className="space-y-3 lg:col-span-4">
            <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <BookOpen className="h-3.5 w-3.5" />
              Tổng kết theo ngày ({dailyLessons.length})
            </h3>
            {dailyLessons.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#12131c] p-8 text-center text-xs text-slate-500">
                Chưa có nhật ký tổng kết ngày nào.
              </div>
            ) : (
              dailyLessons.map((dj) => (
                <div key={dj.date} className="rounded-2xl border border-white/[0.07] bg-[#12131c] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">
                      Ngày {dj.date.split('-').reverse().join('/')}
                    </span>
                    {dj.mood && (
                      <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                        {dj.mood}
                      </span>
                    )}
                  </div>
                  {dj.summary && <p className="mt-2 text-xs text-slate-400">{dj.summary}</p>}
                  {dj.lessons && (
                    <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-100">
                      <strong className="text-amber-300">Bài học:</strong> {dj.lessons}
                    </div>
                  )}
                  {dj.plan_tomorrow && (
                    <div className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-2.5 text-xs text-sky-100">
                      <strong className="text-sky-300">Lưu ý ngày tiếp theo:</strong> {dj.plan_tomorrow}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

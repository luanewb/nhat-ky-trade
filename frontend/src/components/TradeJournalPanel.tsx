import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  CheckSquare,
  ImagePlus,
  Lightbulb,
  Plus,
  Save,
  Square,
  Star,
  Trash2,
} from 'lucide-react';
import { api } from '../api';
import type { ChecklistItem, Settings, Trade } from '../types';

interface TradeJournalPanelProps {
  trade: Trade;
  settings: Settings | null;
  onTradeUpdated: (updated: Trade) => void;
}

export function TradeJournalPanel({ trade, settings, onTradeUpdated }: TradeJournalPanelProps) {
  const [setupNote, setSetupNote] = useState(trade.setup_note);
  const [executionNote, setExecutionNote] = useState(trade.execution_note);
  const [lessonNote, setLessonNote] = useState(trade.lesson_note);
  const [actionNote, setActionNote] = useState(trade.action_note);
  const [setupTags, setSetupTags] = useState<string[]>(trade.setup_tags);
  const [emotionTags, setEmotionTags] = useState<string[]>(trade.emotion_tags);
  const [mistakeTags, setMistakeTags] = useState<string[]>(trade.mistake_tags);
  const [rating, setRating] = useState<number>(trade.rating);
  const [isPlaybook, setIsPlaybook] = useState<boolean>(trade.is_playbook);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [customSl, setCustomSl] = useState<string>(trade.effective_sl ? String(trade.effective_sl) : '');
  const [customTp, setCustomTp] = useState<string>(trade.effective_tp ? String(trade.effective_tp) : '');
  const [screenshots, setScreenshots] = useState(trade.screenshots);

  const [newTagText, setNewTagText] = useState('');
  const [newTagType, setNewTagType] = useState<'setup' | 'emotion' | 'mistake'>('setup');
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  useEffect(() => {
    setSetupNote(trade.setup_note || '');
    setExecutionNote(trade.execution_note || '');
    setLessonNote(trade.lesson_note || '');
    setActionNote(trade.action_note || '');
    setSetupTags(trade.setup_tags || []);
    setEmotionTags(trade.emotion_tags || []);
    setMistakeTags(trade.mistake_tags || []);
    setRating(trade.rating || 0);
    setIsPlaybook(trade.is_playbook || false);
    setCustomSl(trade.effective_sl ? String(trade.effective_sl) : '');
    setCustomTp(trade.effective_tp ? String(trade.effective_tp) : '');
    setScreenshots(trade.screenshots || []);

    if (trade.checklist && trade.checklist.length > 0) {
      setChecklist(trade.checklist);
    } else if (settings?.default_checklist) {
      setChecklist(settings.default_checklist.map((label) => ({ label, checked: false })));
    } else {
      setChecklist([]);
    }
  }, [trade, settings]);

  // Support Ctrl+V pasting screenshots directly into the panel
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const file = new File([blob], `paste_${Date.now()}.png`, { type: blob.type });
            const res = await api.uploadScreenshot(trade.id, file, 'Ảnh dán từ Clipboard');
            setScreenshots(res.screenshots);
            onTradeUpdated({ ...trade, screenshots: res.screenshots });
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [trade, onTradeUpdated]);

  const toggleTag = (list: string[], setList: (v: string[]) => void, tag: string) => {
    if (list.includes(tag)) setList(list.filter((t) => t !== tag));
    else setList([...list, tag]);
  };

  const addCustomTag = () => {
    const val = newTagText.trim();
    if (!val) return;
    if (newTagType === 'setup' && !setupTags.includes(val)) setSetupTags([...setupTags, val]);
    if (newTagType === 'emotion' && !emotionTags.includes(val)) setEmotionTags([...emotionTags, val]);
    if (newTagType === 'mistake' && !mistakeTags.includes(val)) setMistakeTags([...mistakeTags, val]);
    setNewTagText('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        setup_note: setupNote,
        execution_note: executionNote,
        lesson_note: lessonNote,
        action_note: actionNote,
        setup_tags: setupTags,
        emotion_tags: emotionTags,
        mistake_tags: mistakeTags,
        rating,
        checklist,
        is_playbook: isPlaybook,
      };

      const slNum = parseFloat(customSl);
      if (!Number.isNaN(slNum) && slNum > 0 && slNum !== trade.sl_price) {
        payload.custom_sl = slNum;
      }
      const tpNum = parseFloat(customTp);
      if (!Number.isNaN(tpNum) && tpNum > 0 && tpNum !== trade.tp_price) {
        payload.custom_tp = tpNum;
      }

      const updated = await api.updateTrade(trade.id, payload);
      onTradeUpdated(updated);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const res = await api.uploadScreenshot(trade.id, files[0]);
    setScreenshots(res.screenshots);
    onTradeUpdated({ ...trade, screenshots: res.screenshots });
  };

  const handleDeleteShot = async (shotId: string) => {
    const res = await api.deleteScreenshot(trade.id, shotId);
    setScreenshots(res.screenshots);
    onTradeUpdated({ ...trade, screenshots: res.screenshots });
  };

  const presetSetups = Array.from(new Set([...(settings?.setup_tags || []), ...setupTags]));
  const presetEmotions = Array.from(new Set([...(settings?.emotion_tags || []), ...emotionTags]));
  const presetMistakes = Array.from(new Set([...(settings?.mistake_tags || []), ...mistakeTags]));

  return (
    <div className="flex h-full flex-col bg-white text-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-bold text-slate-900">Ghi chú & Bài học rút ra</h4>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaybook((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              isPlaybook
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Đánh dấu vào thư viện A+ Playbook"
          >
            {isPlaybook ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            <span>A+ Playbook</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {savedOk ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            <span>{savedOk ? 'Đã lưu' : saving ? 'Lưu...' : 'Lưu'}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Discipline Rating & Optional SL/TP override for R-Multiple */}
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
          <div>
            <span className="block text-[11px] font-semibold text-slate-600">Kỷ luật thực thi</span>
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                  <Star
                    className={`h-4 w-4 ${
                      n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">SL (tính R)</label>
              <input
                type="number"
                step="any"
                value={customSl}
                onChange={(e) => setCustomSl(e.target.value)}
                placeholder="Giá SL"
                className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500">TP (hộp box)</label>
              <input
                type="number"
                step="any"
                value={customTp}
                onChange={(e) => setCustomTp(e.target.value)}
                placeholder="Giá TP"
                className="mt-0.5 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Structured Notes */}
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-amber-800">
              ★ Bài học rút ra (Lessons Learned)
            </label>
            <textarea
              rows={2}
              value={lessonNote}
              onChange={(e) => setLessonNote(e.target.value)}
              placeholder="Rút ra kinh nghiệm gì từ lệnh này?"
              className="w-full rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 text-xs text-slate-800 focus:border-amber-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-blue-800">
              → Lưu ý cần nhớ cho lần sau (Action Items)
            </label>
            <textarea
              rows={2}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Hành động cụ thể cần làm/tránh ở lệnh tiếp theo..."
              className="w-full rounded-xl border border-blue-200 bg-blue-50/40 p-2.5 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Lý do vào lệnh (Setup & Context)
            </label>
            <textarea
              rows={2}
              value={setupNote}
              onChange={(e) => setSetupNote(e.target.value)}
              placeholder="Xu hướng HTF, vùng thanh khoản, tín hiệu xác nhận..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Diễn biến & Quản lý lệnh (Execution)
            </label>
            <textarea
              rows={2}
              value={executionNote}
              onChange={(e) => setExecutionNote(e.target.value)}
              placeholder="Điểm khớp lệnh, cách dời SL/chốt lời, tâm lý trong lúc gồng..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Tag Selectors */}
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Setup / Chiến lược
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presetSetups.map((tg) => {
                const on = setupTags.includes(tg);
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => toggleTag(setupTags, setSetupTags, tg)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      on
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {tg}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Tâm lý khi giao dịch
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presetEmotions.map((tg) => {
                const on = emotionTags.includes(tg);
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => toggleTag(emotionTags, setEmotionTags, tg)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      on
                        ? 'border-violet-600 bg-violet-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                    }`}
                  >
                    {tg}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Lỗi sai (Mistakes)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {presetMistakes.map((tg) => {
                const on = mistakeTags.includes(tg);
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => toggleTag(mistakeTags, setMistakeTags, tg)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                      on
                        ? 'border-rose-600 bg-rose-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-rose-300'
                    }`}
                  >
                    {tg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Add Custom Tag */}
          <div className="flex gap-1.5">
            <select
              value={newTagType}
              onChange={(e) => setNewTagType(e.target.value as 'setup' | 'emotion' | 'mistake')}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
            >
              <option value="setup">Setup</option>
              <option value="emotion">Tâm lý</option>
              <option value="mistake">Lỗi sai</option>
            </select>
            <input
              value={newTagText}
              onChange={(e) => setNewTagText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
              placeholder="Thêm tag mới..."
              className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs focus:border-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={addCustomTag}
              className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700 hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Pre-trade Checklist */}
        {checklist.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Checklist tuân thủ quy trình
            </span>
            <div className="space-y-1.5">
              {checklist.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setChecklist(
                      checklist.map((it, i) => (i === idx ? { ...it, checked: !it.checked } : it)),
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-50"
                >
                  {item.checked ? (
                    <CheckSquare className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Square className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <span className={item.checked ? 'text-slate-900' : 'text-slate-500'}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Screenshots */}
        <div className="border-t border-slate-100 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Ảnh chụp Chart (HTF / Trước-Sau lệnh)
            </span>
            <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Tải ảnh</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
          </div>
          <p className="mb-2 text-[10px] text-slate-400">
            Mẹo: Bạn có thể nhấn <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono">Ctrl+V</kbd> để dán trực tiếp ảnh chụp màn hình vào lệnh này.
          </p>
          {screenshots.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {screenshots.map((shot) => (
                <div key={shot.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
                  <img
                    src={shot.url}
                    alt={shot.caption || 'Screenshot'}
                    onClick={() => setPreviewImg(shot.url)}
                    className="h-24 w-full cursor-pointer object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteShot(shot.id)}
                    className="absolute top-1 right-1 rounded bg-slate-900/75 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    title="Xóa ảnh"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox for Screenshot */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6"
        >
          <img src={previewImg} alt="Preview" className="max-h-full max-w-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

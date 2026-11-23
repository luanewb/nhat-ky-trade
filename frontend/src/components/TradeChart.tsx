import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import {
  Eye,
  EyeOff,
  FastForward,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import { api, formatPrice, formatUSDExact } from '../api';
import type { Candle, Trade } from '../types';

interface TradeChartProps {
  trade: Trade;
}

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1D'];

function findNearestCandleTime(candles: Candle[], targetTs: number): number | null {
  if (!candles.length) return null;
  let best = candles[0].time;
  let bestDiff = Math.abs(candles[0].time - targetTs);
  for (let i = 1; i < candles.length; i++) {
    const diff = Math.abs(candles[i].time - targetTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candles[i].time;
    }
  }
  return best;
}

export function TradeChart({ trade }: TradeChartProps) {
  const [timeframe, setTimeframe] = useState('5m');
  const [allCandles, setAllCandles] = useState<Candle[]>([]);
  const [candleSource, setCandleSource] = useState<string>('');
  const [isSynthetic, setIsSynthetic] = useState(false);
  const [loading, setLoading] = useState(false);

  // Toggles
  const [showPositionBox, setShowPositionBox] = useState(true);
  const [showKeyLevels, setShowKeyLevels] = useState(true);

  // Bar Replay state
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(350);

  // Crosshair OHLC display
  const [hoverCandle, setHoverCandle] = useState<Candle | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Load candles whenever trade or timeframe changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReplayIndex(null);
    setIsPlaying(false);
    api
      .tradeCandles(trade.id, timeframe)
      .then((res) => {
        if (!active) return;
        setAllCandles(res.candles);
        setCandleSource(res.source);
        setIsSynthetic(res.is_synthetic);
        setHoverCandle(res.candles[res.candles.length - 1] || null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trade.id, timeframe]);

  // Displayed candles (full or sliced for Bar Replay)
  const visibleCandles = useMemo(() => {
    if (replayIndex === null) return allCandles;
    return allCandles.slice(0, Math.max(1, replayIndex));
  }, [allCandles, replayIndex]);

  // Replay timer loop
  useEffect(() => {
    if (!isPlaying || replayIndex === null) return;
    if (replayIndex >= allCandles.length) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayIndex((prev) => (prev !== null ? Math.min(allCandles.length, prev + 1) : null));
    }, replaySpeed);
    return () => window.clearTimeout(timer);
  }, [isPlaying, replayIndex, allCandles.length, replaySpeed]);

  // Compute pre-entry Key Levels (High / Low before entry)
  const keyLevels = useMemo(() => {
    const pre = allCandles.filter((c) => c.time <= trade.entry_time);
    if (pre.length < 5) return null;
    const recent = pre.slice(-45);
    const high = Math.max(...recent.map((c) => c.high));
    const low = Math.min(...recent.map((c) => c.low));
    const mid = (high + low) / 2;
    return { high, low, mid };
  }, [allCandles, trade.entry_time]);

  // Draw Position Box + Floating Blue Tracker Badge (matching Image 2)
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const container = containerRef.current;
    if (!canvas || !chart || !series || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    // Reserve right price scale width (~68px) and bottom time scale height (~28px)
    const plotW = Math.max(0, rect.width - 70);
    const plotH = Math.max(0, rect.height - 28);

    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!showPositionBox || visibleCandles.length === 0) return;

    const lastVisibleTime = visibleCandles[visibleCandles.length - 1].time;
    const entryCandleTime = findNearestCandleTime(allCandles, trade.entry_time);
    const exitCandleTime = findNearestCandleTime(allCandles, trade.exit_time);
    if (!entryCandleTime || lastVisibleTime < entryCandleTime) return;

    const activeEndTime =
      exitCandleTime && lastVisibleTime >= exitCandleTime ? exitCandleTime : lastVisibleTime;

    const x1Raw = chart.timeScale().timeToCoordinate(entryCandleTime as Time);
    const x2Raw = chart.timeScale().timeToCoordinate(activeEndTime as Time);
    if (x1Raw === null && x2Raw === null) return;

    const x1 = x1Raw !== null ? Number(x1Raw) : 0;
    let x2 = x2Raw !== null ? Number(x2Raw) : plotW;
    if (x2 < x1 + 26) x2 = x1 + 26;

    const entryY = series.priceToCoordinate(trade.entry_price);
    if (entryY === null) return;

    const effSl = trade.effective_sl;
    const effTp = trade.effective_tp;
    const isLong = trade.direction === 'LONG';

    // Determine TP target line for Reward Box
    const rewardPrice =
      effTp !== null
        ? effTp
        : isLong
          ? Math.max(trade.exit_price, trade.mfe_price ?? trade.exit_price)
          : Math.min(trade.exit_price, trade.mfe_price ?? trade.exit_price);

    // Determine SL target line for Risk Box
    const riskPrice =
      effSl !== null
        ? effSl
        : isLong
          ? Math.min(trade.exit_price, trade.mae_price ?? trade.entry_price)
          : Math.max(trade.exit_price, trade.mae_price ?? trade.entry_price);

    const rewardY = series.priceToCoordinate(rewardPrice);
    const riskY = series.priceToCoordinate(riskPrice);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotW, plotH);
    ctx.clip();

    const boxX = Math.max(0, x1);
    const boxW = Math.min(plotW, x2) - boxX;

    if (boxW > 2) {
      // Draw Green Reward (TP) Zone
      if (rewardY !== null) {
        const top = Math.min(Number(entryY), Number(rewardY));
        const h = Math.abs(Number(rewardY) - Number(entryY));
        if (h > 1) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
          ctx.fillRect(boxX, top, boxW, h);
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, top, boxW, h);
        }
      }

      // Draw Red Risk (SL) Zone
      if (riskY !== null) {
        const top = Math.min(Number(entryY), Number(riskY));
        const h = Math.abs(Number(riskY) - Number(entryY));
        if (h > 1) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
          ctx.fillRect(boxX, top, boxW, h);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, top, boxW, h);
        }
      }

      // Entry horizontal anchor line inside box
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(boxX, Number(entryY));
      ctx.lineTo(boxX + boxW, Number(entryY));
      ctx.stroke();

      // Floating Blue Long/Short Tracker Badge (exact Image 2 aesthetic!)
      const statusTag = trade.net_profit >= 0 ? 'WIN' : 'LOSS';
      const rPart =
        trade.r_multiple !== null
          ? `${trade.r_multiple >= 0 ? '+' : ''}${trade.r_multiple.toFixed(2)}R `
          : '';
      const line1 = `[${trade.direction}] ${statusTag} | ${rPart}(${formatUSDExact(trade.net_profit)})`;
      const mfeTxt =
        trade.mfe_r !== null
          ? `${trade.mfe_r >= 0 ? '+' : ''}${trade.mfe_r.toFixed(2)}R`
          : trade.mfe_usd !== null
            ? formatUSDExact(trade.mfe_usd)
            : 'N/A';
      const maeTxt =
        trade.mae_r !== null
          ? `${trade.mae_r.toFixed(2)}R`
          : trade.mae_usd !== null
            ? formatUSDExact(trade.mae_usd)
            : 'N/A';
      const line2 = `Max Run: ${mfeTxt} | DD: ${maeTxt}`;

      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const w1 = ctx.measureText(line1).width;
      ctx.font = '500 10.5px Inter, system-ui, sans-serif';
      const w2 = ctx.measureText(line2).width;
      const badgeW = Math.max(w1, w2) + 18;
      const badgeH = 38;

      const topY = Math.min(
        Number(entryY),
        rewardY !== null ? Number(rewardY) : Number(entryY),
        riskY !== null ? Number(riskY) : Number(entryY),
      );
      let badgeX = Math.min(plotW - badgeW - 8, Math.max(8, x2 + 6));
      let badgeY = Math.max(8, topY - badgeH - 6);
      if (badgeY < 8) badgeY = 8;

      // Badge rounded rect
      const r = 6;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, r);
      ctx.fill();

      ctx.strokeStyle = 'rgba(147, 197, 253, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      ctx.fillText(line1, badgeX + 9, badgeY + 15);
      ctx.fillStyle = '#dbeafe';
      ctx.font = '500 10.5px Inter, system-ui, sans-serif';
      ctx.fillText(line2, badgeX + 9, badgeY + 30);
    }

    ctx.restore();
  }, [allCandles, visibleCandles, trade, showPositionBox]);

  // Initialize & update Lightweight Charts instance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#9ca3af',
        fontFamily: 'Inter, -apple-system, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#64748b', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#334155' },
        horzLine: { color: '#64748b', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#334155' },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.12, bottom: 0.22 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: {
        type: 'price',
        precision: trade.entry_price < 20 ? 5 : 2,
        minMove: trade.entry_price < 20 ? 0.00001 : 0.01,
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const ro = new ResizeObserver(() => {
      if (!container) return;
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      requestAnimationFrame(drawOverlay);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [trade.id, trade.entry_price]);

  // Populate series data, price lines, markers & subscribe overlay redraws
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries || visibleCandles.length === 0) return;

    candleSeries.setData(
      visibleCandles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volumeSeries.setData(
      visibleCandles.map((c) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(38, 166, 154, 0.45)' : 'rgba(239, 83, 80, 0.45)',
      })),
    );

    // Markers for Entry and Exit
    const lastTs = visibleCandles[visibleCandles.length - 1].time;
    const entryCandleTime = findNearestCandleTime(visibleCandles, trade.entry_time);
    const exitCandleTime = findNearestCandleTime(visibleCandles, trade.exit_time);
    const markers: SeriesMarker<Time>[] = [];
    if (entryCandleTime && lastTs >= entryCandleTime) {
      markers.push({
        time: entryCandleTime as Time,
        position: trade.direction === 'LONG' ? 'belowBar' : 'aboveBar',
        color: trade.direction === 'LONG' ? '#22c55e' : '#ef4444',
        shape: trade.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        text: `${trade.direction} @ ${formatPrice(trade.entry_price, trade.symbol)}`,
      });
    }
    if (exitCandleTime && lastTs >= trade.exit_time) {
      markers.push({
        time: exitCandleTime as Time,
        position: trade.direction === 'LONG' ? 'aboveBar' : 'belowBar',
        color: '#f59e0b',
        shape: 'circle',
        text: `EXIT ${formatUSDExact(trade.net_profit)}`,
      });
    }
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    candleSeries.setMarkers(markers);

    // Clear & re-add price lines cleanly by tracking created lines
    const createdLines: ReturnType<typeof candleSeries.createPriceLine>[] = [];
    createdLines.push(
      candleSeries.createPriceLine({
        price: trade.entry_price,
        color: '#38bdf8',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: 'Entry',
      }),
    );
    createdLines.push(
      candleSeries.createPriceLine({
        price: trade.exit_price,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Exit',
      }),
    );
    if (trade.effective_sl) {
      createdLines.push(
        candleSeries.createPriceLine({
          price: trade.effective_sl,
          color: '#ef4444',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'SL',
        }),
      );
    }
    if (trade.effective_tp) {
      createdLines.push(
        candleSeries.createPriceLine({
          price: trade.effective_tp,
          color: '#22c55e',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: 'TP',
        }),
      );
    }
    if (showKeyLevels && keyLevels) {
      createdLines.push(
        candleSeries.createPriceLine({
          price: keyLevels.high,
          color: 'rgba(56, 189, 248, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Prev High',
        }),
      );
      createdLines.push(
        candleSeries.createPriceLine({
          price: keyLevels.low,
          color: 'rgba(251, 146, 60, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: 'Prev Low',
        }),
      );
    }

    if (replayIndex === null) {
      chart.timeScale().fitContent();
    }

    const onRangeChange = () => requestAnimationFrame(drawOverlay);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const onCrosshair = (param: { time?: Time }) => {
      if (!param.time) return;
      const found = visibleCandles.find((c) => c.time === Number(param.time));
      if (found) setHoverCandle(found);
    };
    chart.subscribeCrosshairMove(onCrosshair);

    requestAnimationFrame(drawOverlay);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      chart.unsubscribeCrosshairMove(onCrosshair);
      createdLines.forEach((l) => {
        try {
          candleSeries.removePriceLine(l);
        } catch {
          // ignore
        }
      });
    };
  }, [visibleCandles, trade, showKeyLevels, keyLevels, drawOverlay, replayIndex]);

  const startReplay = () => {
    if (!allCandles.length) return;
    const entryCandleTime = findNearestCandleTime(allCandles, trade.entry_time);
    const entryIdx = allCandles.findIndex((c) => c.time === entryCandleTime);
    const startIdx = Math.max(15, entryIdx > 0 ? entryIdx - 12 : 15);
    setReplayIndex(startIdx);
    setIsPlaying(true);
  };

  const resetReplay = () => {
    setIsPlaying(false);
    setReplayIndex(null);
  };

  return (
    <div className="flex h-full flex-col bg-[#131722] text-slate-200">
      {/* Top TradingView-style Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2a2e39] bg-[#161a25] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[#2563eb]/20 px-2 py-0.5 text-xs font-bold text-sky-300">
            {trade.symbol}
          </span>

          {/* Timeframes */}
          <div className="flex items-center rounded-lg bg-[#1e222d] p-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                  timeframe === tf
                    ? 'bg-[#2962ff] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              isSynthetic
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-emerald-500/15 text-emerald-300'
            }`}
            title={
              isSynthetic
                ? 'Biểu đồ mô phỏng theo đúng giá Entry/Exit/MFE/MAE (chưa có nến thực từ MT5 cho khung này)'
                : `Dữ liệu nến thực từ MT5 (${candleSource})`
            }
          >
            {isSynthetic ? 'Simulated OHLC' : 'MT5 Broker Feed'}
          </span>
        </div>

        {/* Right Controls: Position Box, Key Levels, Replay */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowPositionBox((v) => !v)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              showPositionBox ? 'bg-[#2962ff]/25 text-sky-300' : 'bg-[#1e222d] text-slate-400'
            }`}
            title="Bật/tắt hộp Long/Short Position Tool"
          >
            {showPositionBox ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>Position Box</span>
          </button>

          <button
            onClick={() => setShowKeyLevels((v) => !v)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${
              showKeyLevels ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#1e222d] text-slate-400'
            }`}
            title="Bật/tắt đường High/Low trước khi vào lệnh"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Key Levels</span>
          </button>

          <div className="mx-1 h-4 w-px bg-[#2a2e39]" />

          {/* Bar Replay Controls */}
          {replayIndex === null ? (
            <button
              onClick={startReplay}
              className="flex items-center gap-1 rounded-md bg-[#2962ff] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-600"
              title="Tua lại từng cây nến từ trước khi vào lệnh"
            >
              <Play className="h-3 w-3" />
              <span>Bar Replay</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 rounded-md bg-[#1e222d] px-1.5 py-0.5">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="rounded p-1 text-sky-300 hover:bg-slate-700"
                title={isPlaying ? 'Tạm dừng' : 'Tiếp tục'}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setReplayIndex((i) => (i !== null ? Math.min(allCandles.length, i + 1) : null));
                }}
                className="rounded p-1 text-slate-300 hover:bg-slate-700"
                title="Tới 1 cây nến"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setReplaySpeed((s) => (s === 350 ? 150 : s === 150 ? 60 : 350))}
                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700"
                title="Đổi tốc độ tua"
              >
                <FastForward className="h-3 w-3" />
                {replaySpeed === 350 ? '1x' : replaySpeed === 150 ? '2x' : '5x'}
              </button>
              <span className="px-1 text-[10px] text-slate-400">
                {replayIndex}/{allCandles.length}
              </span>
              <button
                onClick={resetReplay}
                className="rounded p-1 text-rose-400 hover:bg-slate-700"
                title="Thoát Replay"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* OHLC Legend Header inside Chart */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#131722] px-3 pt-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-200">
            {trade.symbol} · {timeframe}
          </span>
          {hoverCandle && (
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">
                O <span className="text-slate-200">{formatPrice(hoverCandle.open, trade.symbol)}</span>
              </span>
              <span className="text-slate-400">
                H <span className="text-emerald-400">{formatPrice(hoverCandle.high, trade.symbol)}</span>
              </span>
              <span className="text-slate-400">
                L <span className="text-rose-400">{formatPrice(hoverCandle.low, trade.symbol)}</span>
              </span>
              <span className="text-slate-400">
                C <span className="text-slate-200">{formatPrice(hoverCandle.close, trade.symbol)}</span>
              </span>
              <span className="text-slate-500">Vol {hoverCandle.volume}</span>
            </div>
          )}
        </div>
        <div className="text-[11px] text-slate-400">
          Long/Short Tracker · Entry {formatPrice(trade.entry_price, trade.symbol)} · SL {formatPrice(trade.effective_sl, trade.symbol)} · TP {formatPrice(trade.effective_tp, trade.symbol)}
        </div>
      </div>

      {/* Chart + Synchronized Overlay Canvas */}
      <div className="relative min-h-[380px] flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <canvas
          ref={overlayCanvasRef}
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        />
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#131722]/70 text-xs text-slate-300">
            Đang tải dữ liệu nến {trade.symbol} ({timeframe})...
          </div>
        )}
      </div>
    </div>
  );
}

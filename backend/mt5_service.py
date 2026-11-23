import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from database import cache_candles, compute_r_metrics, get_all_settings, get_conn, upsert_trade

try:
    import MetaTrader5 as mt5  # type: ignore
except ImportError:
    mt5 = None  # type: ignore

TIMEFRAME_SECONDS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
    "4h": 14400,
    "1D": 86400,
}

MT5_TF_MAP = (
    {
        "1m": mt5.TIMEFRAME_M1,
        "5m": mt5.TIMEFRAME_M5,
        "15m": mt5.TIMEFRAME_M15,
        "30m": mt5.TIMEFRAME_M30,
        "1h": mt5.TIMEFRAME_H1,
        "4h": mt5.TIMEFRAME_H4,
        "1D": mt5.TIMEFRAME_D1,
    }
    if mt5 is not None
    else {}
)


def classify_session(unix_ts: int) -> str:
    """Classify trading session based on UTC hour."""
    dt = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
    h = dt.hour
    if 0 <= h < 7:
        return "Asia"
    if 7 <= h < 12:
        return "London"
    if 12 <= h < 16:
        return "Overlap"
    if 16 <= h < 21:
        return "New York"
    return "Asia"


def ts_to_close_date(unix_ts: int, tz_offset_hours: int = 7) -> str:
    tz = timezone(timedelta(hours=tz_offset_hours))
    return datetime.fromtimestamp(unix_ts, tz=tz).strftime("%Y-%m-%d")


def get_mt5_status() -> Dict[str, Any]:
    if mt5 is None:
        return {
            "installed": False,
            "connected": False,
            "message": "Chưa cài đặt thư viện Python MetaTrader5.",
        }
    try:
        ok = mt5.initialize()
        if not ok:
            err = mt5.last_error()
            return {
                "installed": True,
                "connected": False,
                "message": f"Chưa kết nối được MT5 (hãy mở ứng dụng MetaTrader 5 trước). Chi tiết: {err}",
            }
        info = mt5.account_info()
        terminal = mt5.terminal_info()
        if info is None:
            return {
                "installed": True,
                "connected": False,
                "message": "MT5 đang mở nhưng chưa đăng nhập tài khoản giao dịch.",
            }
        return {
            "installed": True,
            "connected": True,
            "account_login": str(info.login),
            "account_name": info.name,
            "server": info.server,
            "company": info.company,
            "balance": round(float(info.balance), 2),
            "equity": round(float(info.equity), 2),
            "currency": info.currency,
            "leverage": info.leverage,
            "terminal_path": getattr(terminal, "path", "") if terminal else "",
            "message": f"Đã kết nối MT5: {info.login} ({info.server})",
        }
    except Exception as exc:
        return {
            "installed": True,
            "connected": False,
            "message": f"Lỗi khi kiểm tra MT5: {exc}",
        }


def _fetch_mt5_rates(symbol: str, timeframe: str, start_ts: int, end_ts: int) -> List[Dict[str, Any]]:
    if mt5 is None or timeframe not in MT5_TF_MAP:
        return []
    try:
        if not mt5.initialize():
            return []
        mt5.symbol_select(symbol, True)
        from_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)
        to_dt = datetime.fromtimestamp(end_ts, tz=timezone.utc)
        rates = mt5.copy_rates_range(symbol, MT5_TF_MAP[timeframe], from_dt, to_dt)
        if rates is None or len(rates) == 0:
            return []
        candles = []
        for r in rates:
            candles.append(
                {
                    "time": int(r["time"]),
                    "open": float(r["open"]),
                    "high": float(r["high"]),
                    "low": float(r["low"]),
                    "close": float(r["close"]),
                    "volume": float(r["tick_volume"]),
                }
            )
        return candles
    except Exception:
        return []


def compute_excursions_from_candles(
    direction: str,
    entry_time: int,
    exit_time: int,
    entry_price: float,
    exit_price: float,
    candles: List[Dict[str, Any]],
) -> Tuple[Optional[float], Optional[float]]:
    """Compute MFE price and MAE price from OHLC candles covering the trade."""
    in_trade = [c for c in candles if entry_time - 300 <= c["time"] <= exit_time + 300]
    if not in_trade:
        if direction == "LONG":
            return max(entry_price, exit_price), min(entry_price, exit_price)
        return min(entry_price, exit_price), max(entry_price, exit_price)

    max_high = max(max(c["high"] for c in in_trade), entry_price, exit_price)
    min_low = min(min(c["low"] for c in in_trade), entry_price, exit_price)
    if direction == "LONG":
        return max_high, min_low
    return min_low, max_high


def sync_mt5_trades(
    days_back: int = 90,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    fetch_candles: bool = True,
) -> Dict[str, Any]:
    if mt5 is None:
        return {"success": False, "message": "Chưa cài đặt thư viện MetaTrader5.", "synced": 0}
    if not mt5.initialize():
        return {
            "success": False,
            "message": f"Không thể kết nối MetaTrader 5. Hãy đảm bảo MT5 đang mở. Lỗi: {mt5.last_error()}",
            "synced": 0,
        }

    info = mt5.account_info()
    if info is None:
        return {"success": False, "message": "MT5 chưa đăng nhập tài khoản.", "synced": 0}

    account_login = str(info.login)
    account_name = f"{info.login} - {info.server}"

    settings = get_all_settings()
    tz_offset = int(settings.get("timezone_offset_hours", 7))

    now_utc = datetime.now(timezone.utc) + timedelta(days=1)
    if date_from:
        from_dt = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    else:
        from_dt = now_utc - timedelta(days=max(1, days_back))
    if date_to:
        to_dt = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        to_dt = now_utc

    deals = mt5.history_deals_get(from_dt, to_dt)
    orders = mt5.history_orders_get(from_dt, to_dt)

    if deals is None:
        return {
            "success": False,
            "message": f"Không lấy được lịch sử deals từ MT5: {mt5.last_error()}",
            "synced": 0,
        }

    # Map position_id -> original SL/TP from orders
    order_sl_tp: Dict[int, Tuple[Optional[float], Optional[float]]] = {}
    if orders:
        for o in orders:
            pid = int(getattr(o, "position_id", 0) or 0)
            if pid <= 0:
                continue
            sl = float(getattr(o, "sl", 0.0) or 0.0)
            tp = float(getattr(o, "tp", 0.0) or 0.0)
            cur_sl, cur_tp = order_sl_tp.get(pid, (None, None))
            if sl > 0 and cur_sl is None:
                cur_sl = sl
            if tp > 0 and cur_tp is None:
                cur_tp = tp
            order_sl_tp[pid] = (cur_sl, cur_tp)

    # Group deals by position_id
    # Deal types: 0 = BUY, 1 = SELL; Entry: 0 = IN, 1 = OUT, 2 = INOUT, 3 = OUT_BY
    positions: Dict[int, List[Any]] = {}
    for d in deals:
        pid = int(getattr(d, "position_id", 0) or 0)
        dtype = int(getattr(d, "type", -1))
        if pid <= 0 or dtype not in (0, 1):
            continue
        positions.setdefault(pid, []).append(d)

    conn = get_conn()
    synced = 0
    candles_cached = 0
    try:
        for pid, p_deals in positions.items():
            p_deals.sort(key=lambda x: (int(x.time), int(x.ticket)))
            entry_deals = [d for d in p_deals if int(d.entry) in (0, 2)]
            exit_deals = [d for d in p_deals if int(d.entry) in (1, 2, 3)]
            if not entry_deals or not exit_deals:
                # Position might still be open or missing entry within date range
                continue

            first_in = entry_deals[0]
            last_out = exit_deals[-1]
            symbol = str(first_in.symbol)
            direction = "LONG" if int(first_in.type) == 0 else "SHORT"

            in_vol = sum(float(d.volume) for d in entry_deals)
            out_vol = sum(float(d.volume) for d in exit_deals)
            if in_vol <= 0 or out_vol <= 0:
                continue

            entry_price = sum(float(d.price) * float(d.volume) for d in entry_deals) / in_vol
            exit_price = sum(float(d.price) * float(d.volume) for d in exit_deals) / out_vol
            entry_time = int(first_in.time)
            exit_time = int(last_out.time)

            gross_profit = sum(float(d.profit) for d in p_deals)
            commission = sum(float(d.commission) + float(getattr(d, "fee", 0.0) or 0.0) for d in p_deals)
            swap = sum(float(d.swap) for d in p_deals)
            net_profit = round(gross_profit + commission + swap, 2)

            # Determine SL/TP from orders or deals
            ord_sl, ord_tp = order_sl_tp.get(pid, (None, None))
            deal_sl = next((float(d.sl) for d in reversed(p_deals) if float(getattr(d, "sl", 0.0) or 0.0) > 0), None)
            deal_tp = next((float(d.tp) for d in reversed(p_deals) if float(getattr(d, "tp", 0.0) or 0.0) > 0), None)
            sl_price = ord_sl or deal_sl
            tp_price = ord_tp or deal_tp

            mfe_price: Optional[float] = None
            mae_price: Optional[float] = None

            if fetch_candles:
                # Cache 5m candles around trade (-90 bars before, +45 bars after)
                c_start = entry_time - 90 * 300
                c_end = exit_time + 45 * 300
                rates_5m = _fetch_mt5_rates(symbol, "5m", c_start, c_end)
                if rates_5m:
                    cache_candles(conn, symbol, "5m", rates_5m)
                    candles_cached += len(rates_5m)
                    mfe_price, mae_price = compute_excursions_from_candles(
                        direction, entry_time, exit_time, entry_price, exit_price, rates_5m
                    )

            metrics = compute_r_metrics(
                direction=direction,
                entry_price=entry_price,
                exit_price=exit_price,
                net_profit=net_profit,
                sl_price=sl_price,
                mfe_price=mfe_price,
                mae_price=mae_price,
            )

            trade_id = f"mt5_{account_login}_{pid}"
            upsert_trade(
                conn,
                {
                    "id": trade_id,
                    "position_id": pid,
                    "account_login": account_login,
                    "account_name": account_name,
                    "symbol": symbol,
                    "direction": direction,
                    "volume": round(out_vol, 4),
                    "entry_time": entry_time,
                    "exit_time": exit_time,
                    "close_date": ts_to_close_date(exit_time, tz_offset),
                    "entry_price": round(entry_price, 6),
                    "exit_price": round(exit_price, 6),
                    "sl_price": round(sl_price, 6) if sl_price else None,
                    "tp_price": round(tp_price, 6) if tp_price else None,
                    "gross_profit": round(gross_profit, 2),
                    "commission": round(commission, 2),
                    "swap": round(swap, 2),
                    "net_profit": net_profit,
                    "r_multiple": metrics["r_multiple"],
                    "mfe_price": round(mfe_price, 6) if mfe_price else None,
                    "mae_price": round(mae_price, 6) if mae_price else None,
                    "mfe_r": metrics["mfe_r"],
                    "mae_r": metrics["mae_r"],
                    "mfe_usd": metrics["mfe_usd"],
                    "mae_usd": metrics["mae_usd"],
                    "session": classify_session(entry_time),
                    "magic": int(getattr(first_in, "magic", 0) or 0),
                    "mt5_comment": str(getattr(first_in, "comment", "") or ""),
                    "source": "mt5",
                },
            )
            synced += 1

        conn.commit()
    finally:
        conn.close()

    return {
        "success": True,
        "account_login": account_login,
        "account_name": account_name,
        "synced": synced,
        "candles_cached": candles_cached,
        "message": f"Đồng bộ thành công {synced} lệnh đóng từ tài khoản {account_name}.",
    }


def _generate_synthetic_candles(trade: Dict[str, Any], timeframe: str) -> List[Dict[str, Any]]:
    """Generate deterministic realistic OHLCV candles matching trade entry/exit/MFE/MAE when MT5 data is unavailable."""
    step = TIMEFRAME_SECONDS.get(timeframe, 300)
    entry_time = int(trade["entry_time"])
    exit_time = max(int(trade["exit_time"]), entry_time + step)
    entry_price = float(trade["entry_price"])
    exit_price = float(trade["exit_price"])
    direction = trade["direction"]

    # Align times to timeframe grid
    start_bar = (entry_time // step) * step - 75 * step
    end_bar = (exit_time // step) * step + 35 * step
    entry_bar = (entry_time // step) * step
    exit_bar = max((exit_time // step) * step, entry_bar + step)

    rng = random.Random(f"{trade['id']}_{timeframe}")
    price_span = abs(exit_price - entry_price)
    eff_sl = trade.get("custom_sl") or trade.get("sl_price")
    if eff_sl:
        price_span = max(price_span, abs(entry_price - float(eff_sl)))
    if price_span < 1e-6:
        price_span = entry_price * 0.002

    vol_unit = max(price_span * 0.14, entry_price * 0.00025)
    precision = 2 if entry_price > 50 else 5

    # Build anchor path: pre-entry -> entry -> (mae) -> (mfe) -> exit -> post-exit
    bars: List[int] = []
    t = start_bar
    while t <= end_bar:
        bars.append(t)
        t += step

    entry_idx = min(range(len(bars)), key=lambda i: abs(bars[i] - entry_bar))
    exit_idx = min(range(len(bars)), key=lambda i: abs(bars[i] - exit_bar))
    if exit_idx <= entry_idx:
        exit_idx = min(len(bars) - 1, entry_idx + 1)

    mfe_p = trade.get("mfe_price")
    mae_p = trade.get("mae_price")
    if mfe_p is None:
        mfe_p = (
            max(entry_price, exit_price) + price_span * 0.18
            if direction == "LONG"
            else min(entry_price, exit_price) - price_span * 0.18
        )
    if mae_p is None:
        mae_p = (
            min(entry_price, exit_price) - price_span * 0.12
            if direction == "LONG"
            else max(entry_price, exit_price) + price_span * 0.12
        )

    # Pre-entry price walk backwards from entry_price
    closes = [0.0] * len(bars)
    closes[entry_idx] = entry_price

    # Create a natural pre-entry structure (impulse + pullback into entry)
    cur = entry_price
    for i in range(entry_idx - 1, -1, -1):
        drift = (0.18 if direction == "LONG" else -0.18) * vol_unit if (entry_idx - i) < 18 else 0.0
        cur = cur - drift + rng.gauss(0, vol_unit * 0.85)
        closes[i] = cur

    # Inside trade: smoothly visit MAE early, then MFE, then exit_price
    span_bars = max(1, exit_idx - entry_idx)
    mae_idx = entry_idx + max(1, int(span_bars * 0.25))
    mfe_idx = entry_idx + max(1, int(span_bars * 0.78))
    if mfe_idx == mae_idx and span_bars > 2:
        mfe_idx = min(exit_idx, mae_idx + 1)

    anchors = {entry_idx: entry_price, exit_idx: exit_price}
    if span_bars >= 3:
        anchors[mae_idx] = float(mae_p)
        anchors[mfe_idx] = float(mfe_p)
    sorted_keys = sorted(anchors.keys())

    for k_i in range(len(sorted_keys) - 1):
        a, b = sorted_keys[k_i], sorted_keys[k_i + 1]
        pa, pb = anchors[a], anchors[b]
        dist = max(1, b - a)
        for idx in range(a, b + 1):
            frac = (idx - a) / dist
            noise = 0.0 if idx in (a, b) else rng.gauss(0, vol_unit * 0.4) * math.sin(frac * math.pi)
            closes[idx] = pa + (pb - pa) * frac + noise

    # Post-exit continuation
    cur = exit_price
    for i in range(exit_idx + 1, len(bars)):
        cur = cur + rng.gauss(0, vol_unit * 0.75)
        closes[i] = cur

    candles: List[Dict[str, Any]] = []
    for i, ts in enumerate(bars):
        op = closes[i - 1] if i > 0 else closes[i] - rng.gauss(0, vol_unit * 0.4)
        cl = closes[i]
        wick_up = abs(rng.gauss(0, vol_unit * 0.45))
        wick_dn = abs(rng.gauss(0, vol_unit * 0.45))
        hi = max(op, cl) + wick_up
        lo = min(op, cl) - wick_dn

        # Ensure exact MFE/MAE containment on anchor bars
        if i == entry_idx:
            hi = max(hi, entry_price)
            lo = min(lo, entry_price)
        if i == exit_idx:
            hi = max(hi, exit_price)
            lo = min(lo, exit_price)

        vol = int(max(40, abs(cl - op) / max(vol_unit, 1e-6) * 320 + rng.uniform(120, 680)))
        candles.append(
            {
                "time": ts,
                "open": round(op, precision),
                "high": round(hi, precision),
                "low": round(lo, precision),
                "close": round(cl, precision),
                "volume": vol,
            }
        )
    return candles


def get_trade_candles(trade: Dict[str, Any], timeframe: str = "5m") -> Dict[str, Any]:
    if timeframe not in TIMEFRAME_SECONDS:
        timeframe = "5m"
    step = TIMEFRAME_SECONDS[timeframe]
    symbol = trade["symbol"]
    entry_time = int(trade["entry_time"])
    exit_time = int(trade["exit_time"])

    lookback_bars = {"1m": 120, "5m": 95, "15m": 80, "30m": 70, "1h": 65, "4h": 55, "1D": 45}.get(timeframe, 80)
    lookahead_bars = {"1m": 60, "5m": 45, "15m": 35, "30m": 30, "1h": 25, "4h": 20, "1D": 15}.get(timeframe, 35)

    start_ts = entry_time - lookback_bars * step
    end_ts = exit_time + lookahead_bars * step

    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT time, open, high, low, close, volume
            FROM candle_cache
            WHERE symbol = ? AND timeframe = ? AND time BETWEEN ? AND ?
            ORDER BY time ASC
            """,
            (symbol, timeframe, start_ts, end_ts),
        ).fetchall()
        candles = [dict(r) for r in rows]

        # Check if cached candles actually span around entry & exit
        has_coverage = (
            len(candles) >= 20
            and candles[0]["time"] <= entry_time + step * 2
            and candles[-1]["time"] >= exit_time - step * 2
        )

        if has_coverage:
            return {
                "symbol": symbol,
                "timeframe": timeframe,
                "source": "demo_cache" if trade.get("source") == "demo" else "mt5_cache",
                "is_synthetic": trade.get("source") == "demo",
                "candles": candles,
            }

        # Try live fetch from MT5 if not demo
        if trade.get("source") != "demo":
            live = _fetch_mt5_rates(symbol, timeframe, start_ts, end_ts)
            if live and len(live) >= 10:
                cache_candles(conn, symbol, timeframe, live)
                conn.commit()
                return {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "source": "mt5_live",
                    "is_synthetic": False,
                    "candles": live,
                }

        # Fallback: deterministic synthetic candles
        synth = _generate_synthetic_candles(trade, timeframe)
        return {
            "symbol": symbol,
            "timeframe": timeframe,
            "source": "synthetic",
            "is_synthetic": True,
            "candles": synth,
        }
    finally:
        conn.close()

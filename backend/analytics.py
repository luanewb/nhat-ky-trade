import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from database import get_all_settings, get_conn, serialize_trade


def _build_where(
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Tuple[str, List[Any]]:
    clauses = ["1=1"]
    params: List[Any] = []
    if account and account != "ALL":
        clauses.append("account_login = ?")
        params.append(account)
    if symbol and symbol != "ALL":
        clauses.append("symbol = ?")
        params.append(symbol)
    if source and source != "ALL":
        clauses.append("source = ?")
        params.append(source)
    if date_from:
        clauses.append("close_date >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("close_date <= ?")
        params.append(date_to)
    return " AND ".join(clauses), params


def get_calendar_data(
    year: int,
    month: int,
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    _, num_days = calendar.monthrange(year, month)
    date_from = f"{year:04d}-{month:02d}-01"
    date_to = f"{year:04d}-{month:02d}-{num_days:02d}"

    settings = get_all_settings()
    daily_loss_limit = float(settings.get("daily_loss_limit", 500.0))
    max_trades_day = int(settings.get("max_trades_per_day", 8))

    where_sql, params = _build_where(account, symbol, source, date_from, date_to)
    conn = get_conn()
    try:
        rows = conn.execute(
            f"SELECT * FROM trades WHERE {where_sql} ORDER BY exit_time ASC",
            params,
        ).fetchall()
        trades = [serialize_trade(r) for r in rows]

        dj_rows = conn.execute(
            "SELECT date, mood, summary, lessons FROM daily_journals WHERE date BETWEEN ? AND ?",
            (date_from, date_to),
        ).fetchall()
        dj_map = {
            r["date"]: bool((r["summary"] or "").strip() or (r["lessons"] or "").strip() or (r["mood"] or "").strip())
            for r in dj_rows
        }
    finally:
        conn.close()

    by_day: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for t in trades:
        by_day[t["close_date"]].append(t)

    days_data: Dict[str, Dict[str, Any]] = {}
    monthly_pnl = 0.0
    monthly_wins = 0
    monthly_losses = 0
    last_trade_date: Optional[str] = None

    for d_str, d_trades in sorted(by_day.items()):
        day_pnl = round(sum(t["net_profit"] for t in d_trades), 2)
        wins = sum(1 for t in d_trades if t["net_profit"] > 0)
        losses = sum(1 for t in d_trades if t["net_profit"] < 0)
        r_vals = [t["r_multiple"] for t in d_trades if t["r_multiple"] is not None]
        day_r = round(sum(r_vals), 2) if r_vals else None

        violations: List[str] = []
        if daily_loss_limit > 0 and day_pnl <= -daily_loss_limit:
            violations.append(f"Vượt giới hạn lỗ ngày (-${daily_loss_limit:,.0f})")
        if max_trades_day > 0 and len(d_trades) > max_trades_day:
            violations.append(f"Quá số lệnh tối đa ({len(d_trades)}/{max_trades_day})")

        noted_count = sum(1 for t in d_trades if t["has_journal"])
        days_data[d_str] = {
            "date": d_str,
            "net_profit": day_pnl,
            "trade_count": len(d_trades),
            "wins": wins,
            "losses": losses,
            "r_total": day_r,
            "noted_count": noted_count,
            "has_daily_journal": dj_map.get(d_str, False),
            "violations": violations,
        }
        monthly_pnl += day_pnl
        monthly_wins += wins
        monthly_losses += losses
        last_trade_date = d_str

    # Compute weekly summaries (Sunday-Saturday calendar rows)
    first_day = date(year, month, 1)
    # Python weekday(): Mon=0..Sun=6; we want Sun=0..Sat=6
    first_sun_offset = (first_day.weekday() + 1) % 7
    grid_start = first_day - timedelta(days=first_sun_offset)
    weeks: List[Dict[str, Any]] = []
    cur = grid_start
    week_idx = 1
    while cur.month == month or cur < first_day:
        if cur > date(year, month, num_days):
            break
        w_pnl = 0.0
        w_trades = 0
        w_days = 0
        for i in range(7):
            d = cur + timedelta(days=i)
            if d.month == month:
                ds = d.strftime("%Y-%m-%d")
                if ds in days_data:
                    w_pnl += days_data[ds]["net_profit"]
                    w_trades += days_data[ds]["trade_count"]
                    w_days += 1
        weeks.append(
            {
                "week": week_idx,
                "net_profit": round(w_pnl, 2),
                "trade_count": w_trades,
                "trading_days": w_days,
            }
        )
        cur += timedelta(days=7)
        week_idx += 1

    total_trades = len(trades)
    winrate = round((monthly_wins / total_trades) * 100, 1) if total_trades > 0 else 0.0

    return {
        "year": year,
        "month": month,
        "monthly_pnl": round(monthly_pnl, 2),
        "total_trades": total_trades,
        "wins": monthly_wins,
        "losses": monthly_losses,
        "winrate": winrate,
        "trading_days": len(days_data),
        "last_trade_date": last_trade_date,
        "days": days_data,
        "weeks": weeks,
    }


def get_analytics(
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    where_sql, params = _build_where(account, symbol, source, date_from, date_to)
    settings = get_all_settings()
    tz_offset = int(settings.get("timezone_offset_hours", 7))
    daily_loss_limit = float(settings.get("daily_loss_limit", 500.0))
    max_trades_day = int(settings.get("max_trades_per_day", 8))

    conn = get_conn()
    try:
        rows = conn.execute(
            f"SELECT * FROM trades WHERE {where_sql} ORDER BY exit_time ASC",
            params,
        ).fetchall()
        trades = [serialize_trade(r) for r in rows]
    finally:
        conn.close()

    total = len(trades)
    if total == 0:
        return {
            "kpis": {
                "total_trades": 0,
                "net_profit": 0,
                "winrate": 0,
                "profit_factor": 0,
                "expectancy_usd": 0,
                "expectancy_r": 0,
                "avg_win": 0,
                "avg_loss": 0,
                "best_trade": 0,
                "worst_trade": 0,
                "max_drawdown": 0,
                "max_win_streak": 0,
                "max_loss_streak": 0,
                "avg_mfe_r": None,
                "avg_mae_r": None,
                "avg_rating": 0,
                "journaled_pct": 0,
            },
            "equity_curve": [],
            "by_session": [],
            "by_weekday": [],
            "by_symbol": [],
            "by_setup": [],
            "by_mistake": [],
            "by_emotion": [],
            "rule_violations": [],
        }

    wins = [t for t in trades if t["net_profit"] > 0]
    losses = [t for t in trades if t["net_profit"] < 0]
    gross_win = sum(t["net_profit"] for t in wins)
    gross_loss = abs(sum(t["net_profit"] for t in losses))
    net_profit = round(sum(t["net_profit"] for t in trades), 2)
    winrate = round((len(wins) / total) * 100, 1)
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else (99.0 if gross_win > 0 else 0.0)
    avg_win = round(gross_win / len(wins), 2) if wins else 0.0
    avg_loss = round(-gross_loss / len(losses), 2) if losses else 0.0
    expectancy_usd = round(net_profit / total, 2)

    r_vals = [t["r_multiple"] for t in trades if t["r_multiple"] is not None]
    expectancy_r = round(sum(r_vals) / len(r_vals), 2) if r_vals else None

    mfe_vals = [t["mfe_r"] for t in trades if t["mfe_r"] is not None]
    mae_vals = [t["mae_r"] for t in trades if t["mae_r"] is not None]
    avg_mfe_r = round(sum(mfe_vals) / len(mfe_vals), 2) if mfe_vals else None
    avg_mae_r = round(sum(mae_vals) / len(mae_vals), 2) if mae_vals else None

    rated = [t["rating"] for t in trades if t["rating"] > 0]
    avg_rating = round(sum(rated) / len(rated), 1) if rated else 0.0
    journaled_pct = round(sum(1 for t in trades if t["has_journal"]) / total * 100, 1)

    # Equity curve + Max Drawdown + Streaks
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    cur_win_streak = 0
    cur_loss_streak = 0
    max_win_streak = 0
    max_loss_streak = 0
    daily_eq: Dict[str, float] = {}

    for t in trades:
        p = t["net_profit"]
        equity = round(equity + p, 2)
        if equity > peak:
            peak = equity
        dd = round(peak - equity, 2)
        if dd > max_dd:
            max_dd = dd

        if p > 0:
            cur_win_streak += 1
            cur_loss_streak = 0
            max_win_streak = max(max_win_streak, cur_win_streak)
        elif p < 0:
            cur_loss_streak += 1
            cur_win_streak = 0
            max_loss_streak = max(max_loss_streak, cur_loss_streak)

        daily_eq[t["close_date"]] = equity

    equity_curve = [{"date": d, "equity": eq} for d, eq in sorted(daily_eq.items())]

    def _agg_group(key_fn) -> List[Dict[str, Any]]:
        buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for t in trades:
            keys = key_fn(t)
            if isinstance(keys, list):
                for k in keys:
                    if k:
                        buckets[k].append(t)
            elif keys:
                buckets[keys].append(t)
        out = []
        for k, items in buckets.items():
            cnt = len(items)
            w = sum(1 for x in items if x["net_profit"] > 0)
            pnl = round(sum(x["net_profit"] for x in items), 2)
            out.append(
                {
                    "name": k,
                    "trades": cnt,
                    "wins": w,
                    "winrate": round(w / cnt * 100, 1) if cnt else 0.0,
                    "net_profit": pnl,
                    "avg_profit": round(pnl / cnt, 2) if cnt else 0.0,
                }
            )
        return out

    session_order = {"Asia": 1, "London": 2, "Overlap": 3, "New York": 4}
    by_session = sorted(_agg_group(lambda t: t["session"]), key=lambda x: session_order.get(x["name"], 9))

    weekday_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"]
    tz = timezone(timedelta(hours=tz_offset))

    def _weekday(t: Dict[str, Any]) -> str:
        dt = datetime.fromtimestamp(t["exit_time"], tz=tz)
        return weekday_names[dt.weekday()]

    by_weekday_map = {x["name"]: x for x in _agg_group(_weekday)}
    by_weekday = [by_weekday_map[n] for n in weekday_names[:5] if n in by_weekday_map]

    by_symbol = sorted(_agg_group(lambda t: t["symbol"]), key=lambda x: x["net_profit"], reverse=True)
    by_setup = sorted(_agg_group(lambda t: t["setup_tags"]), key=lambda x: x["net_profit"], reverse=True)
    by_mistake = sorted(_agg_group(lambda t: t["mistake_tags"]), key=lambda x: x["net_profit"])
    by_emotion = sorted(_agg_group(lambda t: t["emotion_tags"]), key=lambda x: x["net_profit"], reverse=True)

    # Rule Guardian check by day
    by_day: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for t in trades:
        by_day[t["close_date"]].append(t)

    rule_violations: List[Dict[str, Any]] = []
    for d_str, d_trades in sorted(by_day.items(), reverse=True):
        day_pnl = round(sum(x["net_profit"] for x in d_trades), 2)
        if daily_loss_limit > 0 and day_pnl <= -daily_loss_limit:
            rule_violations.append(
                {
                    "date": d_str,
                    "type": "DAILY_LOSS",
                    "message": f"Lỗ ngày ${day_pnl:,.2f} vượt mức giới hạn -${daily_loss_limit:,.0f}",
                }
            )
        if max_trades_day > 0 and len(d_trades) > max_trades_day:
            rule_violations.append(
                {
                    "date": d_str,
                    "type": "OVERTRADING",
                    "message": f"Vào {len(d_trades)} lệnh trong ngày (giới hạn tối đa {max_trades_day} lệnh)",
                }
            )

    return {
        "kpis": {
            "total_trades": total,
            "wins": len(wins),
            "losses": len(losses),
            "net_profit": net_profit,
            "winrate": winrate,
            "profit_factor": profit_factor,
            "expectancy_usd": expectancy_usd,
            "expectancy_r": expectancy_r,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "best_trade": round(max(t["net_profit"] for t in trades), 2),
            "worst_trade": round(min(t["net_profit"] for t in trades), 2),
            "max_drawdown": round(max_dd, 2),
            "max_win_streak": max_win_streak,
            "max_loss_streak": max_loss_streak,
            "avg_mfe_r": avg_mfe_r,
            "avg_mae_r": avg_mae_r,
            "avg_rating": avg_rating,
            "journaled_pct": journaled_pct,
        },
        "equity_curve": equity_curve,
        "by_session": by_session,
        "by_weekday": by_weekday,
        "by_symbol": by_symbol,
        "by_setup": by_setup,
        "by_mistake": by_mistake,
        "by_emotion": by_emotion,
        "rule_violations": rule_violations,
    }

import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from analytics import get_analytics, get_calendar_data
from database import (
    ROOT_DIR,
    UPLOADS_DIR,
    compute_r_metrics,
    ensure_dirs,
    get_all_settings,
    get_conn,
    get_version,
    init_db,
    save_settings,
    serialize_trade,
)
from importer import import_mt5_file
from mt5_service import get_mt5_status, get_trade_candles, sync_mt5_trades
from sample_data import clear_demo_data, load_demo_data

ensure_dirs()
init_db()

app = FastAPI(title="Nhật Ký Giao Dịch MT5 API", version=get_version())

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


class SyncRequest(BaseModel):
    days_back: int = 90
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    fetch_candles: bool = True


class TradeUpdateRequest(BaseModel):
    setup_note: Optional[str] = None
    execution_note: Optional[str] = None
    lesson_note: Optional[str] = None
    action_note: Optional[str] = None
    setup_tags: Optional[List[str]] = None
    emotion_tags: Optional[List[str]] = None
    mistake_tags: Optional[List[str]] = None
    rating: Optional[int] = None
    checklist: Optional[List[Dict[str, Any]]] = None
    is_playbook: Optional[bool] = None
    custom_sl: Optional[float] = None
    custom_tp: Optional[float] = None
    clear_custom_sl: Optional[bool] = False
    clear_custom_tp: Optional[bool] = False


class DailyJournalRequest(BaseModel):
    mood: str = ""
    summary: str = ""
    lessons: str = ""
    plan_tomorrow: str = ""
    rating: int = 0


@app.get("/api/health")
def api_health() -> Dict[str, Any]:
    conn = get_conn()
    try:
        total = conn.execute("SELECT COUNT(*) FROM trades").fetchone()[0]
    finally:
        conn.close()
    return {
        "status": "ok",
        "version": get_version(),
        "total_trades": total,
    }


@app.get("/api/mt5/status")
def api_mt5_status() -> Dict[str, Any]:
    return get_mt5_status()


@app.post("/api/mt5/sync")
def api_mt5_sync(req: SyncRequest) -> Dict[str, Any]:
    return sync_mt5_trades(
        days_back=req.days_back,
        date_from=req.date_from,
        date_to=req.date_to,
        fetch_candles=req.fetch_candles,
    )


@app.post("/api/import")
async def api_import(
    file: UploadFile = File(...),
    account_label: str = Form("MT5 Import"),
) -> Dict[str, Any]:
    content = await file.read()
    return import_mt5_file(file.filename or "report.xlsx", content, account_label)


@app.post("/api/demo/load")
def api_demo_load() -> Dict[str, Any]:
    return load_demo_data()


@app.delete("/api/demo/clear")
def api_demo_clear() -> Dict[str, Any]:
    return clear_demo_data()


@app.get("/api/filters")
def api_filters() -> Dict[str, Any]:
    conn = get_conn()
    try:
        accounts = [
            {"login": r["account_login"], "name": r["account_name"] or r["account_login"]}
            for r in conn.execute(
                "SELECT DISTINCT account_login, account_name FROM trades WHERE account_login != '' ORDER BY account_login"
            ).fetchall()
        ]
        symbols = [
            r["symbol"]
            for r in conn.execute("SELECT DISTINCT symbol FROM trades ORDER BY symbol").fetchall()
        ]
        sources = [
            r["source"]
            for r in conn.execute("SELECT DISTINCT source FROM trades ORDER BY source").fetchall()
        ]
    finally:
        conn.close()
    return {"accounts": accounts, "symbols": symbols, "sources": sources}


@app.get("/api/calendar")
def api_calendar(
    year: int = Query(...),
    month: int = Query(...),
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:
    return get_calendar_data(year, month, account, symbol, source)


@app.get("/api/trades")
def api_list_trades(
    date: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
    playbook_only: bool = False,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    clauses = ["1=1"]
    params: List[Any] = []
    if date:
        clauses.append("close_date = ?")
        params.append(date)
    if date_from:
        clauses.append("close_date >= ?")
        params.append(date_from)
    if date_to:
        clauses.append("close_date <= ?")
        params.append(date_to)
    if account and account != "ALL":
        clauses.append("account_login = ?")
        params.append(account)
    if symbol and symbol != "ALL":
        clauses.append("symbol = ?")
        params.append(symbol)
    if source and source != "ALL":
        clauses.append("source = ?")
        params.append(source)
    if playbook_only:
        clauses.append("is_playbook = 1")
    if search:
        like = f"%{search}%"
        clauses.append(
            "(symbol LIKE ? OR setup_note LIKE ? OR execution_note LIKE ? OR lesson_note LIKE ? OR action_note LIKE ? OR setup_tags LIKE ? OR mistake_tags LIKE ?)"
        )
        params.extend([like] * 7)

    conn = get_conn()
    try:
        rows = conn.execute(
            f"SELECT * FROM trades WHERE {' AND '.join(clauses)} ORDER BY entry_time DESC",
            params,
        ).fetchall()
        trades = [serialize_trade(r) for r in rows]
    finally:
        conn.close()

    return {"trades": trades, "total": len(trades)}


@app.get("/api/trades/{trade_id}")
def api_get_trade(trade_id: str) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh giao dịch.")
        return serialize_trade(row)
    finally:
        conn.close()


@app.patch("/api/trades/{trade_id}")
def api_update_trade(trade_id: str, body: TradeUpdateRequest) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh giao dịch.")
        current = serialize_trade(row)

        updates: Dict[str, Any] = {"updated_at": int(time.time())}
        if body.setup_note is not None:
            updates["setup_note"] = body.setup_note
        if body.execution_note is not None:
            updates["execution_note"] = body.execution_note
        if body.lesson_note is not None:
            updates["lesson_note"] = body.lesson_note
        if body.action_note is not None:
            updates["action_note"] = body.action_note
        if body.setup_tags is not None:
            updates["setup_tags"] = json.dumps(body.setup_tags, ensure_ascii=False)
        if body.emotion_tags is not None:
            updates["emotion_tags"] = json.dumps(body.emotion_tags, ensure_ascii=False)
        if body.mistake_tags is not None:
            updates["mistake_tags"] = json.dumps(body.mistake_tags, ensure_ascii=False)
        if body.rating is not None:
            updates["rating"] = max(0, min(5, int(body.rating)))
        if body.checklist is not None:
            updates["checklist"] = json.dumps(body.checklist, ensure_ascii=False)
        if body.is_playbook is not None:
            updates["is_playbook"] = 1 if body.is_playbook else 0

        recalc_sl = False
        eff_sl = current["effective_sl"]
        if body.clear_custom_sl:
            updates["custom_sl"] = None
            eff_sl = current["sl_price"]
            recalc_sl = True
        elif body.custom_sl is not None:
            updates["custom_sl"] = float(body.custom_sl)
            eff_sl = float(body.custom_sl)
            recalc_sl = True

        if body.clear_custom_tp:
            updates["custom_tp"] = None
        elif body.custom_tp is not None:
            updates["custom_tp"] = float(body.custom_tp)

        if recalc_sl:
            metrics = compute_r_metrics(
                direction=current["direction"],
                entry_price=current["entry_price"],
                exit_price=current["exit_price"],
                net_profit=current["net_profit"],
                sl_price=eff_sl,
                mfe_price=current["mfe_price"],
                mae_price=current["mae_price"],
            )
            updates.update(metrics)

        set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
        conn.execute(
            f"UPDATE trades SET {set_clause} WHERE id = ?",
            [*updates.values(), trade_id],
        )
        conn.commit()
        updated_row = conn.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
        return serialize_trade(updated_row)
    finally:
        conn.close()


@app.delete("/api/trades/{trade_id}")
def api_delete_trade(trade_id: str) -> Dict[str, Any]:
    conn = get_conn()
    try:
        conn.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
        conn.commit()
    finally:
        conn.close()
    return {"success": True}


@app.post("/api/trades/{trade_id}/screenshots")
async def api_upload_screenshot(
    trade_id: str,
    file: UploadFile = File(...),
    caption: str = Form(""),
) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT screenshots FROM trades WHERE id = ?", (trade_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh giao dịch.")
        shots = json.loads(row["screenshots"] or "[]")

        ext = (file.filename or "shot.png").rsplit(".", 1)[-1].lower()
        if ext not in ("png", "jpg", "jpeg", "webp", "gif"):
            ext = "png"
        shot_id = uuid.uuid4().hex[:10]
        fname = f"{trade_id}_{shot_id}.{ext}"
        dest = UPLOADS_DIR / fname
        dest.write_bytes(await file.read())

        new_shot = {
            "id": shot_id,
            "url": f"/uploads/{fname}",
            "caption": caption,
            "created_at": int(time.time()),
        }
        shots.append(new_shot)
        conn.execute(
            "UPDATE trades SET screenshots = ?, updated_at = ? WHERE id = ?",
            (json.dumps(shots, ensure_ascii=False), int(time.time()), trade_id),
        )
        conn.commit()
        return {"screenshot": new_shot, "screenshots": shots}
    finally:
        conn.close()


@app.delete("/api/trades/{trade_id}/screenshots/{shot_id}")
def api_delete_screenshot(trade_id: str, shot_id: str) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT screenshots FROM trades WHERE id = ?", (trade_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh giao dịch.")
        shots = json.loads(row["screenshots"] or "[]")
        kept = []
        for s in shots:
            if s.get("id") == shot_id:
                fname = Path(s.get("url", "")).name
                p = UPLOADS_DIR / fname
                if p.exists():
                    p.unlink(missing_ok=True)
            else:
                kept.append(s)
        conn.execute(
            "UPDATE trades SET screenshots = ?, updated_at = ? WHERE id = ?",
            (json.dumps(kept, ensure_ascii=False), int(time.time()), trade_id),
        )
        conn.commit()
        return {"screenshots": kept}
    finally:
        conn.close()


@app.get("/api/trades/{trade_id}/candles")
def api_trade_candles(trade_id: str, timeframe: str = Query("5m")) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy lệnh giao dịch.")
        trade = serialize_trade(row)
    finally:
        conn.close()
    return get_trade_candles(trade, timeframe)


@app.get("/api/daily-journal/{date_str}")
def api_get_daily_journal(date_str: str) -> Dict[str, Any]:
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM daily_journals WHERE date = ?", (date_str,)).fetchone()
        if row is None:
            return {
                "date": date_str,
                "mood": "",
                "summary": "",
                "lessons": "",
                "plan_tomorrow": "",
                "rating": 0,
            }
        return dict(row)
    finally:
        conn.close()


@app.put("/api/daily-journal/{date_str}")
def api_save_daily_journal(date_str: str, body: DailyJournalRequest) -> Dict[str, Any]:
    now = int(time.time())
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT INTO daily_journals (date, mood, summary, lessons, plan_tomorrow, rating, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                mood = excluded.mood,
                summary = excluded.summary,
                lessons = excluded.lessons,
                plan_tomorrow = excluded.plan_tomorrow,
                rating = excluded.rating,
                updated_at = excluded.updated_at
            """,
            (date_str, body.mood, body.summary, body.lessons, body.plan_tomorrow, body.rating, now),
        )
        conn.commit()
    finally:
        conn.close()
    return {"date": date_str, **body.model_dump(), "updated_at": now}


@app.get("/api/analytics")
def api_analytics(
    account: Optional[str] = None,
    symbol: Optional[str] = None,
    source: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Dict[str, Any]:
    return get_analytics(account, symbol, source, date_from, date_to)


@app.get("/api/lessons")
def api_lessons(
    search: Optional[str] = None,
    playbook_only: bool = False,
    tag: Optional[str] = None,
) -> Dict[str, Any]:
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT * FROM trades
            WHERE (TRIM(lesson_note) != '' OR TRIM(action_note) != '' OR TRIM(setup_note) != '' OR is_playbook = 1)
            ORDER BY exit_time DESC
            """
        ).fetchall()
        trades = [serialize_trade(r) for r in rows]

        daily_rows = conn.execute(
            """
            SELECT * FROM daily_journals
            WHERE (TRIM(lessons) != '' OR TRIM(plan_tomorrow) != '' OR TRIM(summary) != '')
            ORDER BY date DESC
            """
        ).fetchall()
        daily_lessons = [dict(r) for r in daily_rows]
    finally:
        conn.close()

    if playbook_only:
        trades = [t for t in trades if t["is_playbook"]]
    if tag:
        trades = [
            t
            for t in trades
            if tag in t["setup_tags"] or tag in t["emotion_tags"] or tag in t["mistake_tags"]
        ]
    if search:
        q = search.lower()
        trades = [
            t
            for t in trades
            if q in t["symbol"].lower()
            or q in t["lesson_note"].lower()
            or q in t["action_note"].lower()
            or q in t["setup_note"].lower()
            or any(q in tg.lower() for tg in t["setup_tags"] + t["mistake_tags"] + t["emotion_tags"])
        ]
        daily_lessons = [
            d
            for d in daily_lessons
            if q in d["lessons"].lower() or q in d["plan_tomorrow"].lower() or q in d["summary"].lower() or q in d["date"]
        ]

    return {"trade_lessons": trades, "daily_lessons": daily_lessons}


@app.get("/api/settings")
def api_get_settings() -> Dict[str, Any]:
    return get_all_settings()


@app.put("/api/settings")
def api_put_settings(body: Dict[str, Any]) -> Dict[str, Any]:
    return save_settings(body)


# Serve built React frontend if present
DIST_DIR = ROOT_DIR / "frontend" / "dist"
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str) -> Any:
        target = DIST_DIR / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(str(target))
        return FileResponse(str(DIST_DIR / "index.html"))

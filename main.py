"""
main.py – FastAPI + WebSocket バックエンド (ArrayAnimation)
起動: uvicorn main:app --reload --port 8004
"""

import asyncio
import uuid
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

from algorithms import AlgorithmList, DataSizeList

app = FastAPI(title="ArrayAnimation API")

# セッション管理: { session_id: { generator, speed, paused, stopped, ... } }
sessions: dict[str, dict] = {}


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------

@app.get("/api/algorithms")
def get_algorithms():
    return [
        {"id": i, "name": name, "meta": meta}
        for i, (name, fn, meta) in enumerate(AlgorithmList)
    ]


@app.get("/api/datasizes")
def get_datasizes():
    return DataSizeList


class StartParams(BaseModel):
    algorithm_id: int
    num_items:    int   = 16
    speed:        float = 0.10   # 秒/フレーム
    target:       Optional[int] = None        # None = サーバー側で自動生成
    data:         Optional[list[int]] = None  # None = サーバー側で乱数生成


@app.post("/api/start")
def start_session(params: StartParams):
    if params.algorithm_id not in range(len(AlgorithmList)):
        return JSONResponse({"error": "invalid algorithm_id"}, status_code=400)

    algo_name, algo_fn, algo_meta = AlgorithmList[params.algorithm_id]
    generator = algo_fn(params.num_items, params.target, params.data)

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "generator": generator,
        "speed":     params.speed,
        "paused":    False,
        "stopped":   False,
        "algo_name": algo_name,
        "num_items": params.num_items,
    }
    return {
        "session_id": session_id,
        "algo_name":  algo_name,
        "num_items":  params.num_items,
    }


# ---------------------------------------------------------------------------
# WebSocket  /ws/{session_id}
# ---------------------------------------------------------------------------

@app.websocket("/ws/{session_id}")
async def ws_endpoint(ws: WebSocket, session_id: str):
    await ws.accept()

    if session_id not in sessions:
        await ws.send_json({"error": "session not found"})
        await ws.close()
        return

    session = sessions[session_id]

    async def send_frames():
        try:
            for frame in session["generator"]:
                if session["stopped"]:
                    break
                while session["paused"] and not session["stopped"]:
                    await asyncio.sleep(0.05)
                if session["stopped"]:
                    break
                await ws.send_json(frame)
                await asyncio.sleep(session["speed"])
        except Exception:
            pass

    async def recv_controls():
        try:
            while True:
                msg = await ws.receive_json()
                action = msg.get("action", "")
                if action == "set_speed":
                    session["speed"] = float(msg.get("speed", 0.08))
                elif action == "pause":
                    session["paused"] = True
                elif action == "resume":
                    session["paused"] = False
                elif action == "stop":
                    session["stopped"] = True
                    break
        except WebSocketDisconnect:
            session["stopped"] = True
        except Exception:
            session["stopped"] = True

    sender   = asyncio.create_task(send_frames())
    receiver = asyncio.create_task(recv_controls())

    done, pending = await asyncio.wait(
        [sender, receiver],
        return_when=asyncio.FIRST_COMPLETED,
    )
    for t in pending:
        t.cancel()

    sessions.pop(session_id, None)
    try:
        await ws.close()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 静的ファイル
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "static" / "index.html")

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

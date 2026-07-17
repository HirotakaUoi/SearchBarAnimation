/**
 * ws_client.js  –  WebSocket クライアント（送受信ラッパー）
 */

"use strict";

// Render 無料枠は「インバウンド通信が15分無い」とインスタンスがスピンダウンし
// 接続が切れるため、接続中は一定間隔で ping を送り続ける
// （サーバー側 recv_controls は未知 action として無視するだけで副作用なし）。
// 明示的な停止・完了・切断が無くても、最大1時間で送信を打ち切る。
const WS_KEEPALIVE_INTERVAL_MS = 45 * 1000;
const WS_KEEPALIVE_MAX_MS      = 60 * 60 * 1000;

class AnimationClient {
  /**
   * @param {string}   sessionId
   * @param {Function} onFrame   - (frame: object) => void
   * @param {Function} onClose   - () => void
   * @param {Function} onError   - (event) => void
   */
  constructor(sessionId, onFrame, onClose, onError) {
    this.sessionId = sessionId;
    this.onFrame   = onFrame;
    this.onClose   = onClose;
    this.onError   = onError ?? (() => {});
    this.ws        = null;
    this._kaTimer  = null;
    this._kaStart  = 0;
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${location.host}/ws/${this.sessionId}`;
    this.ws     = new WebSocket(url);

    this.ws.onopen = () => this._startKeepAlive();

    this.ws.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data);
        this.onFrame(frame);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => { this._stopKeepAlive(); this.onClose(); };
    this.ws.onerror = (ev) => this.onError(ev);
  }

  _startKeepAlive() {
    this._stopKeepAlive();
    this._kaStart = Date.now();
    this._kaTimer = setInterval(() => {
      if (Date.now() - this._kaStart >= WS_KEEPALIVE_MAX_MS) {
        this._stopKeepAlive();
        return;
      }
      this._send({ action: "ping" });
    }, WS_KEEPALIVE_INTERVAL_MS);
  }

  _stopKeepAlive() {
    if (this._kaTimer) {
      clearInterval(this._kaTimer);
      this._kaTimer = null;
    }
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  }

  setSpeed(speed)  { this._send({ action: "set_speed", speed }); }
  pause()          { this._send({ action: "pause" }); }
  resume()         { this._send({ action: "resume" }); }
  stop()           { this._send({ action: "stop" }); }

  disconnect() {
    this._stopKeepAlive();
    if (this.ws) {
      this.ws.onclose = null;   // クローズイベントを無効化
      this.ws.close();
      this.ws = null;
    }
  }
}

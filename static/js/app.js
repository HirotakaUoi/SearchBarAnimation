/**
 * app.js  –  パネル管理・メインアプリケーション (ArrayAnimation)
 *
 * 各パネルは独立した WebSocket 接続を持ち、
 * 複数パネルを同時に実行できる。
 * パネルはコンテナ内をフリードラッグで自由に配置できる。
 */

"use strict";

// ===== グローバル状態 ==============================================
let algorithms = [];   // [{ id, name, meta }, ...]
let dataSizes  = [];   // [8, 12, ...]
let panelSeq   = 0;    // パネル ID 採番
let zoomLevel  = 1.0;  // パネルコンテナのズーム倍率

// ===== スナップ設定 ================================================
const SNAP_THRESHOLD = 15;
const SNAP_GAP       = 10;

function _getTopLeftPanel(excludeEl = null) {
  let best = null, bestDist = Infinity;
  document.querySelectorAll(".panel").forEach(p => {
    if (p === excludeEl) return;
    const d = Math.sqrt(p.offsetLeft ** 2 + p.offsetTop ** 2);
    if (d < bestDist) { bestDist = d; best = p; }
  });
  return best;
}

function _snapValue(val, snapPoints, threshold) {
  let closest = val, minDiff = threshold;
  for (const sp of snapPoints) {
    const diff = Math.abs(val - sp);
    if (diff < minDiff) { minDiff = diff; closest = sp; }
  }
  return closest;
}

// ===== 起動 ========================================================
window.addEventListener("DOMContentLoaded", async () => {
  await loadMeta();
  _setupGlobalControls();
  _setupZoomControls();
  document.getElementById("btn-add-panel")   .addEventListener("click", addPanel);
  document.getElementById("btn-start-all")   .addEventListener("click", startAll);
  document.getElementById("btn-pause-all")   .addEventListener("click", pauseAll);
  document.getElementById("btn-stop-all")    .addEventListener("click", stopAll);
  document.getElementById("btn-reset-all")   .addEventListener("click", resetAll);
  document.getElementById("btn-sync-size")   .addEventListener("click", syncSize);
  document.getElementById("btn-apply-global").addEventListener("click", applyGlobalToAll);
  addPanel();
});

async function loadMeta() {
  const [alRes, dsRes] = await Promise.all([
    fetch("/api/algorithms"),
    fetch("/api/datasizes"),
  ]);
  algorithms = await alRes.json();
  dataSizes  = await dsRes.json();
}

// ===== 全パネル一括設定 ============================================

function _setupGlobalControls() {
  const gSize = document.getElementById("global-size");
  dataSizes.forEach(s => gSize.appendChild(new Option(String(s), s)));
  gSize.value = 16;

  const gSpeed    = document.getElementById("global-speed");
  const gSpeedVal = document.getElementById("global-speed-val");
  gSpeed.addEventListener("input", () => {
    const mult = Math.round(Number(gSpeed.value) / 80 * 10) / 10;
    gSpeedVal.textContent = `×${mult.toFixed(1)}`;
  });
}

/** 全パネルへグローバル設定を適用（ボタン押下時） */
function applyGlobalToAll() {
  const size        = Number(document.getElementById("global-size").value);
  const speedSlider = Number(document.getElementById("global-speed").value);
  let   targetRaw   = document.getElementById("global-target").value.trim();

  const maxVal = size >= 200 ? 999 : 99;

  // target が空(自動)のときは1つだけ乱数を生成して全パネルで共有
  if (targetRaw === "") {
    targetRaw = String(Math.floor(Math.random() * maxVal) + 1);
    document.getElementById("global-target").value = targetRaw;
  }

  // データセットを1回だけ生成して全パネルで共有
  const sharedValues = Array.from({ length: size },
                                   () => Math.floor(Math.random() * maxVal) + 1);

  document.querySelectorAll(".panel").forEach(el => {
    const panel = el._panel;
    if (!panel) return;
    el.querySelector(".rng-speed").value   = speedSlider;
    panel._applySpeed(speedSlider);
    if (!panel.isRunning) {
      el.querySelector(".sel-size").value   = size;
      el.querySelector(".inp-target").value = targetRaw;
      panel._applySharedPreview(sharedValues, targetRaw);
    }
  });
}

// ===== ズーム ======================================================

function _applyZoom(level) {
  const ZOOM_MIN = 0.25, ZOOM_MAX = 2.0;
  zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(level * 10) / 10));
  document.getElementById("panels-container").style.transform = `scale(${zoomLevel})`;
  document.getElementById("zoom-label").textContent = Math.round(zoomLevel * 100) + "%";
}

function _setupZoomControls() {
  document.getElementById("btn-zoom-in")   .addEventListener("click", () => _applyZoom(zoomLevel + 0.1));
  document.getElementById("btn-zoom-out")  .addEventListener("click", () => _applyZoom(zoomLevel - 0.1));
  document.getElementById("btn-zoom-reset").addEventListener("click", () => _applyZoom(1.0));
  document.getElementById("panels-container").addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    _applyZoom(zoomLevel + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
}

// ===== コンテナサイズ更新 ==========================================

function _updateContainerSize() {
  const container = document.getElementById("panels-container");
  let maxRight = 0, maxBottom = 0;
  container.querySelectorAll(".panel").forEach(p => {
    maxRight  = Math.max(maxRight,  p.offsetLeft + p.offsetWidth  + 20);
    maxBottom = Math.max(maxBottom, p.offsetTop  + p.offsetHeight + 20);
  });
  container.style.minWidth  = maxRight  + "px";
  container.style.minHeight = maxBottom + "px";
}

// ===== サイズ統一 ==================================================

function syncSize() {
  const panels = [...document.querySelectorAll(".panel")];
  if (panels.length < 2) return;
  const front = panels.reduce((a, b) =>
    (parseInt(b.style.zIndex) || 1) > (parseInt(a.style.zIndex) || 1) ? b : a
  );
  const w = front.offsetWidth;
  const h = front.offsetHeight;
  panels.forEach(el => {
    if (el !== front) {
      el.style.width  = w + "px";
      el.style.height = h + "px";
    }
  });
}

// ===== パネル追加 ==================================================
function addPanel() {
  const panel = new ArrayPanel(++panelSeq);
  panel.mount(document.getElementById("panels-container"));
}

// ===== 全開始 / 全一時停止 / 全停止 / 全リセット ====================
function startAll() {
  document.querySelectorAll(".panel").forEach((el) => {
    const p = el._panel;
    if (p && !p.isRunning) p.start();
  });
}
function pauseAll() {
  const panels = [...document.querySelectorAll(".panel")]
    .map(el => el._panel).filter(p => p && p.isRunning);
  const anyRunning = panels.some(p => !p.isPaused);
  panels.forEach(p => {
    if (anyRunning && !p.isPaused) p.togglePause();
    else if (!anyRunning && p.isPaused) p.togglePause();
  });
  document.getElementById("btn-pause-all").textContent =
    anyRunning ? "▶ 全再開" : "⏸ 全一時停止";
}
function stopAll() {
  document.querySelectorAll(".panel").forEach((el) => {
    const p = el._panel;
    if (p && p.isRunning) p.stop();
  });
  document.getElementById("btn-pause-all").textContent = "⏸ 全一時停止";
}
function resetAll() {
  document.querySelectorAll(".panel").forEach((el) => {
    const p = el._panel;
    if (p) p.reset();
  });
  document.getElementById("btn-pause-all").textContent = "⏸ 全一時停止";
}

// ===================================================================
// ArrayPanel クラス
// ===================================================================
class ArrayPanel {
  constructor(id) {
    this.id          = id;
    this.sessionId   = null;
    this.client      = null;
    this.arrayCanvas = null;
    this.el          = null;
    this.isRunning   = false;
    this.isPaused    = false;
    this.numItems    = 0;
    this._lastFrame  = null;
    this._frameCount = 0;
  }

  // ── DOM 構築 ────────────────────────────────────────────────────
  mount(container) {
    const el = document.createElement("div");
    el.className = "panel";
    el._panel    = this;
    el.id        = `panel-${this.id}`;
    el.innerHTML = this._template();

    // 既存パネルの右端に配置
    let initLeft = 0, initTop = 0;
    const existing = container.querySelectorAll(".panel");
    if (existing.length > 0) {
      let maxRight = 0, maxBottom = 0;
      existing.forEach(p => {
        maxRight  = Math.max(maxRight,  p.offsetLeft + p.offsetWidth  + 12);
        maxBottom = Math.max(maxBottom, p.offsetTop  + p.offsetHeight + 12);
      });
      const panelW = 520;
      if (maxRight + panelW <= window.innerWidth) {
        initLeft = maxRight;
        initTop  = 0;
      } else {
        initLeft = 0;
        initTop  = maxBottom;
      }
    }
    el.style.left = initLeft + "px";
    el.style.top  = initTop  + "px";
    container.appendChild(el);
    this.el = el;

    this._bind();
    this._populateSelects();
    this._bringToFront();
    requestAnimationFrame(() => this._drawPreview());
    return el;
  }

  _template() {
    return `
      <div class="panel-header">
        <span class="drag-handle" title="ドラッグして移動">⠿</span>
        <span class="panel-title">パネル ${this.id}</span>
        <button class="panel-close" title="削除">✕</button>
      </div>

      <div class="params-row">
        <label>アルゴリズム
          <select class="sel-algo"></select>
        </label>
      </div>
      <div class="params-row">
        <label>データ数
          <select class="sel-size"></select>
        </label>
        <label>target
          <input type="number" class="inp-target" min="0" max="999" placeholder="自動"
                 style="width:60px" title="探索する値 (空欄=自動)">
        </label>
        <div class="speed-group">
          <label>速度</label>
          <input type="range" class="rng-speed" min="1" max="200" value="80"
                 title="大きいほど速い">
          <span class="speed-value">×1.0</span>
        </div>
      </div>

      <div class="controls-row">
        <button class="btn btn-primary   btn-start">▶ 開始</button>
        <button class="btn btn-warning   btn-pause" disabled>⏸ 一時停止</button>
        <button class="btn btn-danger    btn-stop"  disabled>⏹ 停止</button>
        <button class="btn btn-secondary btn-reset" disabled>↺ リセット</button>
      </div>

      <div class="canvas-wrapper">
        <canvas class="array-canvas"></canvas>
        <div class="text-overlay">（開始ボタンを押してください）</div>
      </div>

      <div class="status-bar">
        <span class="status-algo">-</span>
        <span class="status-state">待機中</span>
        <span class="status-frames">フレーム: 0</span>
      </div>
    `;
  }

  // ── セレクトを動的に生成 ─────────────────────────────────────
  _populateSelects() {
    const selAlgo = this.el.querySelector(".sel-algo");
    algorithms.forEach(a => selAlgo.appendChild(new Option(a.name, a.id)));
    selAlgo.value = (this.id - 1) % algorithms.length;

    const selSize = this.el.querySelector(".sel-size");
    dataSizes.forEach(s => selSize.appendChild(new Option(String(s), s)));
    selSize.value = document.getElementById("global-size")?.value || 16;

    const gSpeed = document.getElementById("global-speed")?.value;
    if (gSpeed) {
      this.el.querySelector(".rng-speed").value = gSpeed;
      this._applySpeed(Number(gSpeed));
    }
  }

  // ── イベントバインド ─────────────────────────────────────────
  _bind() {
    const q = (sel) => this.el.querySelector(sel);

    q(".panel-close").addEventListener("click", () => this.destroy());
    q(".btn-start")  .addEventListener("click", () => this.start());
    q(".btn-pause")  .addEventListener("click", () => this.togglePause());
    q(".btn-stop")   .addEventListener("click", () => this.stop());
    q(".btn-reset")  .addEventListener("click", () => this.reset());

    q(".rng-speed").addEventListener("input", (ev) => {
      this._applySpeed(Number(ev.target.value));
    });

    q(".sel-algo") .addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });
    q(".sel-size") .addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });
    q(".inp-target").addEventListener("change", () => { if (!this.isRunning) this._drawPreview(); });

    this.el.addEventListener("mousedown", () => this._bringToFront());

    // キャンバスリサイズ監視
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(this.el);
    ro.observe(q(".canvas-wrapper"));

    // フリードラッグ
    const handle = q(".drag-handle");
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this._bringToFront();
      handle.style.cursor = "grabbing";
      let prevX = e.clientX, prevY = e.clientY;

      const onMove = (mv) => {
        const dx = (mv.clientX - prevX) / zoomLevel;
        const dy = (mv.clientY - prevY) / zoomLevel;
        prevX = mv.clientX;
        prevY = mv.clientY;

        let newLeft = (parseFloat(this.el.style.left) || 0) + dx;
        let newTop  = (parseFloat(this.el.style.top)  || 0) + dy;

        const ref = _getTopLeftPanel(this.el);
        if (ref) {
          const rL = ref.offsetLeft, rT = ref.offsetTop;
          const rR = rL + ref.offsetWidth, rB = rT + ref.offsetHeight;
          const cW = this.el.offsetWidth,   cH = this.el.offsetHeight;
          newLeft = _snapValue(newLeft, [rL, rR - cW, rR + SNAP_GAP, rL - cW - SNAP_GAP], SNAP_THRESHOLD);
          newTop  = _snapValue(newTop,  [rT, rB - cH, rB + SNAP_GAP, rT - cH - SNAP_GAP], SNAP_THRESHOLD);
        }
        this.el.style.left = newLeft + "px";
        this.el.style.top  = newTop  + "px";
        _updateContainerSize();
      };
      const onUp = () => {
        handle.style.cursor = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
  }

  // ── 最前面へ ──────────────────────────────────────────────────
  _bringToFront() {
    let maxZ = 0;
    document.querySelectorAll(".panel").forEach(p => {
      maxZ = Math.max(maxZ, parseInt(p.style.zIndex) || 1);
    });
    this.el.style.zIndex = maxZ + 1;
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("front"));
    this.el.classList.add("front");
  }

  // ── リサイズハンドラ ─────────────────────────────────────────
  _onResize() {
    const ref = _getTopLeftPanel(this.el);
    if (ref) {
      const snapW = _snapValue(this.el.offsetWidth,  [ref.offsetWidth],  SNAP_THRESHOLD);
      const snapH = _snapValue(this.el.offsetHeight, [ref.offsetHeight], SNAP_THRESHOLD);
      if (snapW !== this.el.offsetWidth)  this.el.style.width  = snapW + "px";
      if (snapH !== this.el.offsetHeight) this.el.style.height = snapH + "px";
    }

    const wrapper = this.el.querySelector(".canvas-wrapper");
    const canvas  = this.el.querySelector(".array-canvas");
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    if (w <= 0 || h <= 0) return;

    const sizeChanged = (canvas.width !== w || canvas.height !== h);
    if (!sizeChanged) return;
    canvas.width  = w;
    canvas.height = h;

    if (this._lastFrame) {
      // 実行中 or 完了後: 最終フレームを再描画
      const ac = new ArrayCanvas(canvas);
      if (this.isRunning && this.arrayCanvas) {
        this.arrayCanvas.canvas = canvas;
        this.arrayCanvas.ctx    = canvas.getContext("2d");
      }
      ac.draw(this._lastFrame);
    } else {
      this._drawPreviewOnCanvas(canvas);
    }
  }

  // ── プレビュー描画 ──────────────────────────────────────────
  _drawPreview() {
    const wrapper = this.el.querySelector(".canvas-wrapper");
    const canvas  = this.el.querySelector(".array-canvas");
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight || Math.round(w * 0.55);
    if (w <= 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
    this._drawPreviewOnCanvas(canvas);
  }

  /** 全パネル一括適用用: 外部から渡した共有データでプレビューを描画 */
  _applySharedPreview(sharedValues, targetRaw) {
    const wrapper = this.el.querySelector(".canvas-wrapper");
    const canvas  = this.el.querySelector(".array-canvas");
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight || Math.round(w * 0.55);
    if (w <= 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
    const algoId = Number(this.el.querySelector(".sel-algo").value);
    const algo   = algorithms.find(a => a.id === algoId);
    const sorted = !!(algo && algo.meta && algo.meta.sorted);
    const forced = targetRaw !== "" ? Number(targetRaw) : null;
    this._previewCache = new ArrayCanvas(canvas).drawPreview(
      sharedValues.length, sorted, forced, sharedValues
    );
  }

  _drawPreviewOnCanvas(canvas) {
    const numItems = Number(this.el.querySelector(".sel-size").value) || 16;
    const algoId   = Number(this.el.querySelector(".sel-algo").value);
    const algo     = algorithms.find(a => a.id === algoId);
    const sorted   = !!(algo && algo.meta && algo.meta.sorted);
    const tRaw     = this.el.querySelector(".inp-target").value.trim();
    const forced   = tRaw !== "" ? Number(tRaw) : null;
    this._previewCache = new ArrayCanvas(canvas).drawPreview(numItems, sorted, forced);
  }

  // ── スピード変換 ─────────────────────────────────────────────
  _applySpeed(sliderVal) {
    const speed = Math.round(800 / sliderVal * 10) / 1000;
    const mult  = Math.round(sliderVal / 80 * 10) / 10;
    this.el.querySelector(".speed-value").textContent = `×${mult.toFixed(1)}`;
    if (this.client) this.client.setSpeed(speed);
    this._speed = speed;
  }

  _currentSpeed() {
    const v = Number(this.el.querySelector(".rng-speed").value);
    return Math.round(200 / v * 10) / 1000;
  }

  // ── 開始 ────────────────────────────────────────────────────────
  async start() {
    if (this.isRunning) return;

    const algoId   = Number(this.el.querySelector(".sel-algo").value);
    const numItems = Number(this.el.querySelector(".sel-size").value);
    const speed    = this._currentSpeed();

    let info;
    try {
      const tRaw = this.el.querySelector(".inp-target").value.trim();
      const body = { algorithm_id: algoId, num_items: numItems, speed };
      if (tRaw !== "") {
        body.target = Number(tRaw);
      } else if (this._previewCache?.target !== undefined) {
        body.target = this._previewCache.target;
      }
      if (this._previewCache?.values) {
        body.data = this._previewCache.values;
      }
      const res = await fetch("/api/start", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      info = await res.json();
    } catch (e) {
      this._setStatus(`エラー: ${e.message}`, "red");
      return;
    }

    this.sessionId   = info.session_id;
    this.numItems    = info.num_items;
    this.isRunning   = true;
    this.isPaused    = false;
    this._lastFrame  = null;
    this._frameCount = 0;

    const canvas = this.el.querySelector(".array-canvas");
    this.arrayCanvas = new ArrayCanvas(canvas);

    this.el.querySelector(".panel-title").textContent = info.algo_name;
    this.el.classList.add("running");
    this.el.classList.remove("finished");
    this._setStatus("実行中", "#90caf9");
    this._setBtns({ start: false, pause: true, stop: true, reset: false });
    this.el.querySelector(".status-algo").textContent = info.algo_name;
    this.el.querySelector(".text-overlay").textContent = "";

    this.client = new AnimationClient(
      this.sessionId,
      (frame) => this._onFrame(frame),
      ()      => this._onClose(),
      ()      => this._setStatus("接続エラー", "red"),
    );
    this.client.connect();
  }

  // ── フレーム受信 ─────────────────────────────────────────────
  _onFrame(frame) {
    this._lastFrame   = frame;
    this._frameCount  = (this._frameCount ?? 0) + 1;

    this.arrayCanvas.draw(frame);
    this.el.querySelector(".status-frames").textContent =
      `フレーム: ${this._frameCount}`;

    if (frame.finished) {
      this.isRunning = false;
      this.el.classList.remove("running");
      this.el.classList.add("finished");
      this._setStatus("完了", "#44aa44");
      this._setBtns({ start: false, pause: false, stop: false, reset: true });
    }
  }

  // ── WebSocket クローズ ────────────────────────────────────────
  _onClose() {
    if (this.isRunning) {
      this.isRunning = false;
      this.el.classList.remove("running");
      this._setStatus("切断", "#888");
      this._setBtns({ start: true, pause: false, stop: false, reset: false });
    }
  }

  // ── 一時停止 / 再開 ────────────────────────────────────────────
  togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    const btn = this.el.querySelector(".btn-pause");
    if (this.isPaused) {
      this.client.pause();
      btn.textContent = "▶ 再開";
      this._setStatus("一時停止", "#FFD700");
    } else {
      this.client.resume();
      btn.textContent = "⏸ 一時停止";
      this._setStatus("実行中", "#90caf9");
    }
  }

  // ── 停止 ─────────────────────────────────────────────────────
  stop() {
    if (!this.isRunning) return;
    this.client?.stop();
    this.client?.disconnect();
    this.client    = null;
    this.isRunning = false;
    this.el.classList.remove("running");
    this._setStatus("停止", "#888");
    this._setBtns({ start: true, pause: false, stop: false, reset: true });
  }

  // ── リセット ─────────────────────────────────────────────────
  reset() {
    if (this.isRunning) this.stop();
    this.el.querySelector(".text-overlay").textContent = "（開始ボタンを押してください）";
    this.el.querySelector(".status-frames").textContent = "フレーム: 0";
    this.el.classList.remove("finished");
    this._setStatus("待機中", "#888");
    this._setBtns({ start: true, pause: false, stop: false, reset: false });
    this.arrayCanvas = null;
    this._lastFrame  = null;
    this._frameCount = 0;
    this._drawPreview();
  }

  // ── パネル削除 ───────────────────────────────────────────────
  destroy() {
    this.stop();
    this.el?.remove();
  }

  // ── ヘルパー ─────────────────────────────────────────────────
  _setBtns({ start, pause, stop, reset }) {
    const q = (s) => this.el.querySelector(s);
    q(".btn-start").disabled = !start;
    q(".btn-pause").disabled = !pause;
    q(".btn-stop") .disabled = !stop;
    q(".btn-reset").disabled = !reset;
    if (!pause) q(".btn-pause").textContent = "⏸ 一時停止";
  }

  _setStatus(text, color = "#aaa") {
    const el = this.el.querySelector(".status-state");
    el.textContent = text;
    el.style.color = color;
  }
}

/**
 * array_canvas.js  –  array1d 縦棒グラフ描画ユーティリティ
 *
 * フレーム形式:
 *   { objects: [array1d, ...], texts: [{message, color}, ...], finished: bool }
 *
 * array1d オブジェクト:
 *   { id, type:"array1d", values, label,
 *     highlights: {"i": color}, fills: [{from,to,color}],
 *     pointer: {index,label,color}|null,
 *     watchman_index: int|null,
 *     target: int|null }   ← target が設定されると左端に参照バーを表示
 */

"use strict";

// ---------------------------------------------------------------------------
// カラーテーマ (canvas 背景・ラベル色のみ)
// ---------------------------------------------------------------------------
const AC_THEMES = {
  dark:     { canvasBg: "#0d1117",  valueLabelColor: "#ccc",  indexLabelColor: "#4a6080",
              foundCellBg: "#1a4a1a", foundCellText: "#44cc44",
              textOverlay: "rgba(10,14,26,0.78)" },
  bright:   { canvasBg: "#f0f4ff",  valueLabelColor: "#334",  indexLabelColor: "#668",
              foundCellBg: "#b8f0b8", foundCellText: "#005500",
              textOverlay: "rgba(10,20,40,0.88)" },
  hc:       { canvasBg: "#000000",  valueLabelColor: "#fff",  indexLabelColor: "#888",
              foundCellBg: "#003300", foundCellText: "#00ff66",
              textOverlay: "rgba(0,0,0,0.90)" },
  hcbright: { canvasBg: "#ffffff",  valueLabelColor: "#111",  indexLabelColor: "#445",
              foundCellBg: "#a8eea8", foundCellText: "#003300",
              textOverlay: "rgba(10,20,40,0.88)" },
};
let _acThemeKey = "bright";   // 初期テーマは明るめ（index.html の <body data-theme> と ☀ ボタンの theme-active も同じにする）
function _acTheme() { return AC_THEMES[_acThemeKey] ?? AC_THEMES.dark; }
function setCanvasTheme(k) { _acThemeKey = k; }

class ArrayCanvas {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
  }

  get cw() { return this.canvas.width;  }
  get ch() { return this.canvas.height; }

  // ── メイン描画 ────────────────────────────────────────────────────
  draw(frame) {
    const { objects = [], texts = [], finished = false, found = null } = frame;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);

    // 背景
    ctx.fillStyle = _acTheme().canvasBg;
    ctx.fillRect(0, 0, this.cw, this.ch);

    // 説明文の帯: グラフはこの下から描き、説明文がバーや探索値の水平線・参照バーの値に重ならないようにする。
    // 説明はコマごとに 1〜3 行と変わるので、帯の高さは常に 3 行分で固定する（コマごとにグラフが上下に動かないように）。
    // キャンバスが低いときは、帯をキャンバスの高さの 3 割までに抑える（その分だけ説明がグラフに重なる）
    const TEXT_LINE_H = 16, TEXT_PAD = 4, TEXT_MAX_LINES = 3;
    const textBand = Math.min(TEXT_MAX_LINES * TEXT_LINE_H + TEXT_PAD * 2, Math.round(this.ch * 0.3));

    // オブジェクトエリア (説明文の帯の下、キャンバスの残り全部)
    const nObjs = objects.length;
    if (nObjs > 0) {
      const eachH = (this.ch - textBand) / nObjs;
      for (let oi = 0; oi < nObjs; oi++) {
        if (objects[oi].type === "array1d") {
          this._drawArray1d(objects[oi], textBand + oi * eachH, eachH);
        }
      }
    }

    // テキストオーバーレイ (説明文の帯に半透明背景で描く)
    if (texts.length > 0) {
      const pad = TEXT_PAD;
      const boxH = texts.length * TEXT_LINE_H + pad * 2;
      ctx.save();
      ctx.fillStyle = _acTheme().textOverlay;
      ctx.fillRect(0, 0, this.cw, boxH);
      ctx.font = "13px monospace";
      for (let i = 0; i < texts.length; i++) {
        ctx.fillStyle = texts[i].color || "#ddd";
        ctx.textAlign = "left";
        ctx.fillText(texts[i].message, 8, pad + (i + 1) * TEXT_LINE_H - 3);
      }
      ctx.restore();
    }

    // 完了時の表示について:
    // Found/Not Found/完了 のいずれも、キャンバス上のデータ構造をdimして
    // 隠さないよう、ここでは一切描かない。全てコントロールパネル側の
    // ステータス表示 (status-done-badge) に任せる。
  }

  // ── array1d 縦棒グラフ描画 ────────────────────────────────────────
  _drawArray1d(obj, areaY, areaH) {
    const {
      values = [], label = "",
      highlights = {}, fills = [],
      pointer = null, watchman_index = null,
      target = null,
    } = obj;
    const n = values.length;
    if (n === 0) return;

    const ctx = this.ctx;
    const cw  = this.cw;

    // レイアウト定数
    const PAD_T = 22;   // バー上部の余白 (ポインタラベル用)
    const PAD_B = 16;   // バー下部の余白 (インデックスラベル用)
    const PAD_L = 8;
    const PAD_R = 8;

    // 参照バーエリア (target があるとき左端に確保)
    const HAS_TARGET = target !== null;
    const REF_W   = HAS_TARGET ? 30 : 0;
    const REF_GAP = HAS_TARGET ? 10 : 0;

    const chartL = PAD_L + REF_W + REF_GAP;
    const chartR = cw - PAD_R;
    const chartT = areaY + PAD_T;
    const chartB = areaY + areaH - PAD_B;
    const chartH = chartB - chartT;
    const barW   = (chartR - chartL) / n;

    const dataMax = Math.max(...values, HAS_TARGET ? target : 0, 1);
    const valToY  = (v) => chartT + chartH * (1 - v / dataMax);
    const valToH  = (v) => chartH * v / dataMax;

    ctx.save();

    // ラベル
    if (label) {
      ctx.fillStyle = "#6a8faf";
      ctx.font      = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, PAD_L, areaY + 12);
    }

    // ── 参照バー (target) ──
    if (HAS_TARGET) {
      const refX = PAD_L;
      const refY = valToY(target);
      const refH = valToH(target);
      const rw   = REF_W - 2;

      // バー本体
      ctx.fillStyle   = _acTheme().foundCellBg;
      ctx.fillRect(refX + 0.5, refY, rw - 1, refH);
      ctx.strokeStyle = _acTheme().foundCellText;
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(refX + 0.5, refY + 0.5, rw - 1, refH - 1);
      // 探索値の高さの水平線は、バーに隠れないよう後で（バーより上のレイヤに）描く

      // 値ラベル (参照バーの上)
      const rFs = Math.max(7, Math.min(10, REF_W * 0.4));
      ctx.fillStyle = _acTheme().foundCellText;
      ctx.font      = `${rFs}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(String(target), refX + REF_W / 2 - 1, refY - 3);
    }

    // ── バー ──
    const showLabel = barW >= 14;
    for (let i = 0; i < n; i++) {
      const x = chartL + i * barW;
      const y = valToY(values[i]);
      const h = valToH(values[i]);

      const isWatchman = (watchman_index === i);
      const hlColor    = highlights[String(i)];

      // バー色
      ctx.fillStyle = isWatchman ? "#cc6600"
                    : hlColor    ? hlColor
                    :              "#4472C4";
      ctx.fillRect(x + 0.5, y, barW - 1, h);

      // 値ラベル (バー上)
      if (showLabel) {
        const fs = Math.min(11, barW * 0.65);
        ctx.fillStyle = _acTheme().valueLabelColor;
        ctx.font      = `${fs}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(String(values[i]), x + barW / 2, y - 2);
      }
    }

    // ── フィル (バーの上に重ねて除外済み領域を暗くする) ──
    for (const fill of fills) {
      const from = Math.max(0, fill.from);
      const to   = Math.min(n - 1, fill.to);
      ctx.globalAlpha = 0.78;
      ctx.fillStyle   = fill.color;
      ctx.fillRect(chartL + from * barW, chartT,
                   (to - from + 1) * barW, chartH);
      ctx.globalAlpha = 1.0;
    }

    // ── 探索値 (target) の高さの水平線 ──
    // 選択ソートの基準線と同じく、バーとフィルより上のレイヤに太めの破線で描く
    // （参照バーの右辺から右端まで。色は参照バーの縁と同じ緑で、どの値と比べているかが分かるように）
    if (HAS_TARGET) {
      const lineY = Math.round(valToY(target)) + 0.5;
      ctx.save();
      ctx.strokeStyle = _acTheme().foundCellText;
      ctx.lineWidth   = 2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_L + REF_W - 2, lineY);
      ctx.lineTo(chartR, lineY);
      ctx.stroke();
      ctx.restore();
    }

    // ── インデックスラベル (バー下) ──
    if (barW >= 14) {
      const iFs = Math.min(9, barW * 0.5);
      ctx.fillStyle = _acTheme().indexLabelColor;
      ctx.font      = `${iFs}px sans-serif`;
      ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        ctx.fillText(String(i),
                     chartL + i * barW + barW / 2,
                     chartB + 12);
      }
    }

    // ── ポインタ矢印 (バー上端に向けて上から下向きに) ──
    if (pointer) {
      const { index, label: pLabel, color: pColor = "#cc00cc" } = pointer;
      const px   = chartL + index * barW + barW / 2;
      const tipY = valToY(values[index]) - 2;  // バー上端の少し上
      const topY = chartT - 4;                 // 矢印シャフトの根元

      ctx.strokeStyle = pColor;
      ctx.lineWidth   = 1.5;
      if (topY + (pLabel ? 12 : 0) < tipY - 7) {
        ctx.beginPath();
        ctx.moveTo(px, topY + (pLabel ? 12 : 0));
        ctx.lineTo(px, tipY - 7);
        ctx.stroke();
      }

      // 矢じり (下向き三角)
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.moveTo(px,     tipY);
      ctx.lineTo(px - 5, tipY - 7);
      ctx.lineTo(px + 5, tipY - 7);
      ctx.closePath();
      ctx.fill();

      // ポインタラベル
      if (pLabel) {
        const lFs = Math.max(7, Math.min(10, barW * 0.6));
        ctx.fillStyle = pColor;
        ctx.font      = `${lFs}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(pLabel, px, topY + 10);
      }
    }

    ctx.restore();
  }

  // ── プレビュー描画 ────────────────────────────────────────────────
  /** ランダム配列 + 参照バーのプレビューを描画する */
  drawPreview(numItems, sorted = false, forcedTarget = null, sharedValues = null) {
    // sharedValues が渡された場合はそれを使用（ソートはコピーに対して行う）
    const maxVal = numItems >= 200 ? 999 : 99;
    let values = sharedValues
      ? [...sharedValues]
      : Array.from({ length: numItems }, () => Math.floor(Math.random() * maxVal) + 1);
    if (sorted) values.sort((a, b) => a - b);
    const target = (forcedTarget !== null) ? forcedTarget
                                           : values[Math.floor(Math.random() * numItems)];
    this.draw({
      objects: [{
        id: "preview", type: "array1d",
        values,
        label:          "Data",
        highlights:     {},
        fills:          [],
        pointer:        null,
        watchman_index: null,
        target,
      }],
      texts:    [],
      finished: false,
    });
    return { values, target };
  }
}

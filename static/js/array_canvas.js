/**
 * array_canvas.js  –  array1d オブジェクト描画ユーティリティ
 *
 * フレーム形式:
 *   { objects: [array1d, ...], texts: [{message, color}, ...], finished: bool }
 *
 * array1d オブジェクト:
 *   { id, type:"array1d", values, label,
 *     highlights: {"i": color}, fills: [{from,to,color}],
 *     pointer: {index,label,color}|null, watchman_index: int|null }
 */

"use strict";

class ArrayCanvas {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext("2d");
  }

  get cw() { return this.canvas.width;  }
  get ch() { return this.canvas.height; }

  // ── メイン描画 ────────────────────────────────────────────────────
  /** フレームを描画する */
  draw(frame) {
    const { objects = [], texts = [], finished = false } = frame;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);

    // 背景
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, this.cw, this.ch);

    // テキストエリア (キャンバス上部)
    const TEXT_LINE_H = 20;
    const textH = texts.length > 0 ? texts.length * TEXT_LINE_H + 6 : 2;

    ctx.save();
    ctx.font = "13px monospace";
    for (let i = 0; i < texts.length; i++) {
      ctx.fillStyle = texts[i].color || "#ddd";
      ctx.textAlign = "left";
      ctx.fillText(texts[i].message, 8, 4 + (i + 1) * TEXT_LINE_H);
    }
    ctx.restore();

    // オブジェクトエリア (テキストの下)
    const objAreaTop = textH;
    const objAreaH   = this.ch - objAreaTop;
    const nObjs      = objects.length;
    if (nObjs > 0) {
      const eachH = objAreaH / nObjs;
      for (let oi = 0; oi < nObjs; oi++) {
        if (objects[oi].type === "array1d") {
          this._drawArray1d(objects[oi], objAreaTop + oi * eachH, eachH);
        }
      }
    }

    // 完了オーバーレイ
    if (finished) {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.6)";
      ctx.fillRect(0, 0, this.cw, this.ch);
      const fs = Math.min(40, this.cw / 8);
      ctx.fillStyle = "#FFD700";
      ctx.font      = `bold ${fs}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("完了!", this.cw / 2, this.ch / 2 + fs * 0.35);
      ctx.restore();
    }
  }

  // ── array1d 描画 ──────────────────────────────────────────────────
  _drawArray1d(obj, areaY, areaH) {
    const {
      values = [], label = "",
      highlights = {}, fills = [],
      pointer = null, watchman_index = null,
    } = obj;
    const n = values.length;
    if (n === 0) return;

    const ctx = this.ctx;
    const cw  = this.cw;

    // レイアウト定数
    const PAD_L   = 8, PAD_R = 8;
    const LABEL_H = label ? 14 : 0;
    const PTR_H   = 28;   // セル上部のポインタ矢印エリア
    const IDX_H   = 14;   // セル下部のインデックスラベルエリア
    const GAP     = 2;

    const totalFixed = LABEL_H + PTR_H + IDX_H + GAP * 2;
    const cellW = (cw - PAD_L - PAD_R) / n;
    const cellH = Math.max(16, Math.min(areaH - totalFixed, cellW * 1.4, 54));

    const cellsX = PAD_L;
    const cellsY = areaY + LABEL_H + GAP + PTR_H
                   + Math.max(0, (areaH - totalFixed - cellH) / 2);

    ctx.save();

    // ラベル
    if (label) {
      ctx.fillStyle = "#6a8faf";
      ctx.font      = "11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(label, PAD_L, areaY + 12);
    }

    // フィル（範囲オーバーレイ）— セルの後ろ
    for (const fill of fills) {
      const from = Math.max(0, fill.from);
      const to   = Math.min(n - 1, fill.to);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle   = fill.color;
      ctx.fillRect(cellsX + from * cellW, cellsY - 1,
                   (to - from + 1) * cellW, cellH + 2);
      ctx.globalAlpha = 1.0;
    }

    // セル
    for (let i = 0; i < n; i++) {
      const cx         = cellsX + i * cellW;
      const isWatchman = (watchman_index === i);
      const hlColor    = highlights[String(i)];

      // 背景
      ctx.fillStyle = isWatchman ? "#2a1500"
                    : hlColor    ? hlColor
                    :              "#1e2d3d";
      ctx.fillRect(cx + 0.5, cellsY, cellW - 1, cellH);

      // ボーダー
      ctx.strokeStyle = isWatchman ? "#ff8800"
                      : hlColor    ? "#666"
                      :              "#3a5a7a";
      ctx.lineWidth = isWatchman ? 2 : 1;
      ctx.strokeRect(cx + 0.5, cellsY + 0.5, cellW - 1, cellH - 1);

      // 値テキスト
      const vFs = Math.min(13, cellW * 0.6, cellH * 0.45);
      if (vFs >= 5) {
        ctx.fillStyle = isWatchman ? "#ff8800"
                      : hlColor    ? "#111"
                      :              "#ccd";
        ctx.font      = `${vFs}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(String(values[i]),
                     cx + cellW / 2,
                     cellsY + cellH / 2 + vFs * 0.35);
      }
    }

    // インデックスラベル（セルの下）
    if (cellW >= 12) {
      const iFs = Math.min(9, cellW * 0.45);
      ctx.fillStyle = "#4a6080";
      ctx.font      = `${iFs}px sans-serif`;
      ctx.textAlign = "center";
      for (let i = 0; i < n; i++) {
        ctx.fillText(String(i),
                     cellsX + i * cellW + cellW / 2,
                     cellsY + cellH + 11);
      }
    }

    // ポインタ矢印（セルの上から下向き）
    if (pointer) {
      const { index, label: pLabel, color: pColor = "#cc00cc" } = pointer;
      const px        = cellsX + index * cellW + cellW / 2;
      const tipY      = cellsY - 3;
      const shaftTopY = cellsY - PTR_H + 4;
      const shaftBotY = tipY - 7;

      ctx.strokeStyle = pColor;
      ctx.lineWidth   = 1.5;
      if (shaftBotY > shaftTopY + (pLabel ? 12 : 0)) {
        ctx.beginPath();
        ctx.moveTo(px, shaftTopY + (pLabel ? 12 : 0));
        ctx.lineTo(px, shaftBotY);
        ctx.stroke();
      }

      // 矢じり
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.moveTo(px,     tipY);
      ctx.lineTo(px - 5, tipY - 7);
      ctx.lineTo(px + 5, tipY - 7);
      ctx.closePath();
      ctx.fill();

      // ラベル
      if (pLabel) {
        const lFs = Math.max(7, Math.min(10, cellW * 0.55));
        ctx.fillStyle = pColor;
        ctx.font      = `${lFs}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(pLabel, px, shaftTopY + 10);
      }
    }

    ctx.restore();
  }

  // ── プレビュー描画（アニメーション開始前） ────────────────────────
  /** ランダム配列を描画する（開始前のプレビュー用） */
  drawPreview(numItems) {
    const values = Array.from({ length: numItems },
                               () => Math.floor(Math.random() * 99) + 1);
    this.draw({
      objects: [{
        id: "preview", type: "array1d",
        values,
        label:          "Data",
        highlights:     {},
        fills:          [],
        pointer:        null,
        watchman_index: null,
      }],
      texts:    [],
      finished: false,
    });
  }
}

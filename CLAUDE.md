# SearchBarAnimation

配列探索アルゴリズムを縦棒グラフ形式でアニメーション表示する Web アプリ。

## 起動

```bash
uvicorn main:app --reload --port 8004
```

ブラウザ: http://localhost:8004

## 対応アルゴリズム（5種）

| アルゴリズム | 説明 |
|---|---|
| 線形探索（基本） | 先頭から順に比較 |
| 線形探索（番兵法） | 末尾に番兵を追加して終端チェックを省略 |
| 線形探索（整列済み配列） | ソート済み配列で `data[i] > target` なら早期終了 |
| 二分探索（反復） | 探索範囲を半分ずつ絞り込む反復版 |
| 二分探索（再帰） | 同じ二分探索の再帰版 |

## UI の特徴

- 左端の **参照バー（緑）** が探索対象 (`target`) の高さを示す
- 終了時に **Found（緑）/ Not Found（赤）** オーバーレイで結果表示
- 複数パネル同時表示でアルゴリズム比較可能

## target の仕様

- 空欄: 70% の確率でデータ内の値、30% で範囲外の値を自動選択
- 数値入力: その値を target として探索

## ファイル構成

```
main.py              # FastAPI + WebSocket エンドポイント
algorithms.py        # 各探索アルゴリズムのジェネレータ
requirements.txt
render.yaml
static/
  index.html
  css/style.css
  js/
    array_canvas.js  # Canvas 描画ユーティリティ
    ws_client.js     # WebSocket クライアント
    app.js           # パネル管理・メインアプリ
```

## アーキテクチャ

```
[Browser] ←─ WebSocket ─→ [FastAPI / main.py] ←─ import ─→ [algorithms.py]
  app.js                    /api/start                         generator関数群
  array_canvas.js           /ws/{session_id}
```

## アルゴリズム追加手順

1. `algorithms.py` にジェネレータ関数を実装
2. `AlgorithmList` に登録: `("表示名", my_func, {"type": "search"})`

---

## 現在のファイルバージョン

| ファイル | バージョン |
|---|---|
| `static/js/app.js` | **v16** |
| `static/js/array_canvas.js` | **v9** |
| `static/js/ws_client.js` | **v2** |
| `static/css/style.css` | **v4** |

---

## 最近の変更履歴

| 日付 | 内容 |
|---|---|
| 2026-07-17 (2) | 対象配列の意図しない再抽選を修正 — target入力・ウインドウ/パネルリサイズ・アルゴリズム切替・テーマ切替・リセットで配列と自動targetが毎回ランダムに再生成されていたのを、パネルごとに保持して使い回すよう変更（二分探索系への切替は同じ値をソート表示）。再生成されるのは「データ数変更」「🎲 配列再生成ボタン（新設）」「全パネルへ適用」の明示操作のみ (app.js v15→v16) |
| 2026-07-17 | WebSocket keep-alive を追加 — 接続中は45秒間隔で `{"action":"ping"}` を送信し、Render 無料枠の「インバウンド通信15分無しでスピンダウン」による切断を防止（一時停止中も有効）。明示的な停止・完了・切断が無くても最大1時間で送信を打ち切る。サーバー側は未知 action を無視する既存実装のまま変更なし (ws_client.js v1→v2) |
| 2026-07-03 | 完了時の全画面dim+中央大表示（完了!/Found!/Not Found）を廃止。キャンバス上には一切描かず、ステータスバーの `status-done-badge` に固定背景色バッジ（テーマが変わっても視認性が落ちない）で表示するよう変更。表示時に短いフラッシュアニメーション(1.4秒)を付与。副次的に、テーマ切替時に実行中でないパネル（完了後含む）が最終フレームでなくプレビューに巻き戻るバグも発見・修正 (array_canvas.js v8→v9, app.js v14→v15, style.css v3→v4) |
| 2026-05-11 | drag/resize を Pointer Events API に統一 — `setPointerCapture` で軸ロック完全解消 (app.js v13→v14) |
| 2026-05-10 | タッチドラッグ軸ロックバグ修正 / スナップをリリース時のみ適用 / タッチデバイス対応 (app.js v10→v13) |
| 2026-05-03 | カラーテーマ全面対応 (dark/bright/hc/hcbright) — array_canvas.js v8 |

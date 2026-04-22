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

# SearchBarAnimation

配列探索アルゴリズムをブラウザ上でリアルタイムにアニメーション表示する可視化ツールです。

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## 概要

FastAPI + WebSocket によるサーバーサイド生成と Canvas 2D API による描画を組み合わせ、
各アルゴリズムの動作を縦棒グラフ形式でステップごとに可視化します。

- 左端の **参照バー（緑）** が探索対象 (`target`) の高さを示します
- アニメーション終了時に **Found（緑）/ Not Found（赤）** のオーバーレイで結果を表示します
- 複数パネルを同時に開いて異なるアルゴリズムを並べて比較できます

## 対応アルゴリズム

| アルゴリズム | 説明 |
|---|---|
| 線形探索（基本） | 先頭から順に比較 |
| 線形探索（番兵法） | 末尾に番兵を追加して終端チェックを省略 |
| 線形探索（整列済み配列） | ソート済み配列で `data[i] > target` なら早期終了 |
| 二分探索（反復） | 探索範囲を半分ずつ絞り込む反復版 |
| 二分探索（再帰） | 同じ二分探索の再帰版 |

## スクリーンショット

![アニメーション例](static/screenshot.png)

## 動作環境

- Python 3.10 以上
- モダンブラウザ（Chrome / Firefox / Safari / Edge）

## セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/HirotakaUoi/SearchBarAnimation.git
cd SearchBarAnimation

# 依存パッケージをインストール
pip install -r requirements.txt

# サーバーを起動
uvicorn main:app --reload --port 8004
```

ブラウザで http://localhost:8004 を開いてください。

## 使い方

1. **パネル追加** ボタンでアニメーションパネルを追加
2. パネルごとにアルゴリズム・データ数・target・速度を設定
3. **開始** ボタンでアニメーション再生
4. **全パネルへ適用** で全パネルに同じデータセット・target を一括設定して比較実行

### target の指定

- 空欄のまま開始すると、70% の確率でデータ内の値、30% で範囲外の値が自動選択されます
- 数値を入力すると、その値を target として探索します

## ファイル構成

```
SearchBarAnimation/
├── main.py              # FastAPI サーバー・WebSocket エンドポイント
├── algorithms.py        # 各探索アルゴリズムのジェネレータ
├── requirements.txt
└── static/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── array_canvas.js  # Canvas 描画ユーティリティ
        ├── ws_client.js     # WebSocket クライアント
        └── app.js           # パネル管理・メインアプリ
```

## ライセンス

MIT

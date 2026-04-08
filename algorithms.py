"""
algorithms.py – Web 向けアルゴリズムジェネレータ

各ジェネレータは以下の JSON 互換フレームを yield する:
{
  "objects": [
    {
      "id":             str,
      "type":           "array1d",
      "values":         [int, ...],
      "label":          str,
      "highlights":     {"index_str": color, ...},
      "fills":          [{"from": int, "to": int, "color": str}, ...],
      "pointer":        {"index": int, "label": str, "color": str} | None,
      "watchman_index": int | None,
      "target":         int | None,   # 参照バー用
    }
  ],
  "texts":    [{"message": str, "color": str}, ...],
  "finished": bool
}
"""

from random import randint, random as _rand

# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _f(objects, texts=None, finished=False, found=None):
    """フレームを作成する。found: True=発見, False=未発見, None=通常完了"""
    return {"objects": objects, "texts": texts or [], "finished": finished, "found": found}


def _a(id, values, label="", hl=None, fills=None, ptr=None, watchman=None, target=None):
    """array1d オブジェクト記述子を作成する。"""
    return {
        "id":             id,
        "type":           "array1d",
        "values":         list(values),
        "label":          label,
        "highlights":     {str(k): v for k, v in (hl or {}).items()},
        "fills":          fills or [],
        "pointer":        ptr,
        "watchman_index": watchman,
        "target":         target,
    }


def _ptr(index, label, color="#cc00cc"):
    """ポインタ(矢印)記述子を作成する。"""
    return {"index": index, "label": str(label), "color": color}


def _max_val(n):
    """データサイズに基づく値の最大値を返す。"""
    return 999 if n >= 200 else 99


def _auto_target(data):
    """70% の確率でデータ内の値、30% で範囲外の値を返す。"""
    if _rand() < 0.7:
        return data[randint(0, len(data) - 1)]
    return randint(1, _max_val(len(data)))


# ---------------------------------------------------------------------------
# 線形探索 (基本)  ─ Liner_Search.demo01 相当
# ---------------------------------------------------------------------------

def linear_search(n, target=None, data=None):
    data = list(data) if data is not None else [randint(1, _max_val(n)) for _ in range(n)]
    if target is None:
        target = _auto_target(data)
    N = len(data)
    base = [{"message": f"N = {N},   target = {target}", "color": "white"}]

    yield _f([_a("data", data, "Data", target=target)], base)

    for i in range(N):
        found = (data[i] == target)
        cmp   = "==" if found else "!="
        t     = base + [{"message": f"data[{i}] = {data[i]}   {cmp}   {target}", "color": "red" if found else "lightgreen"}]
        ptr   = _ptr(i, f"<=> {target}")

        if found:
            t2 = base + [{"message": f"Found!   index = {i}", "color": "red"}]
            for _ in range(3):
                yield _f([_a("data", data, "Data", hl={i: "yellow"}, ptr=_ptr(i, f"<=> {target}"), target=target)], t2)
                yield _f([_a("data", data, "Data", hl={i: "#ff4444"}, ptr=_ptr(i, f"== {target}", "red"), target=target)], t2)
            yield _f([_a("data", data, "Data", hl={i: "#ff4444"}, target=target)], t2, finished=True, found=True)
            return

        yield _f([_a("data", data, "Data", hl={i: "yellow"}, ptr=ptr, target=target)], t)

    t = base + [{"message": "Target Not Found!", "color": "red"}]
    yield _f([_a("data", data, "Data", target=target)], t, finished=True, found=False)


# ---------------------------------------------------------------------------
# 線形探索 (番兵法)  ─ Liner_Search.demo02 相当
# ---------------------------------------------------------------------------

def linear_search_watchman(n, target=None, data=None):
    data = list(data) if data is not None else [randint(1, _max_val(n)) for _ in range(n)]
    if target is None:
        target = _auto_target(data)
    N = len(data)
    base = [{"message": f"N = {N},   target = {target}", "color": "white"}]

    yield _f([_a("data", data, "Data", target=target)], base)

    # 番兵を末尾に追加
    s = data + [target]
    t = base + [{"message": f"番兵 {target} を末尾 (index {N}) に追加", "color": "orange"}]
    yield _f([_a("data", s, "Data", hl={N: "yellow"}, watchman=N, target=target)], t)

    i = 0
    while s[i] != target:
        t2 = base + [{"message": f"data[{i}] = {s[i]}   !=   {target}", "color": "lightgreen"}]
        yield _f([_a("data", s, "Data", hl={i: "yellow"}, ptr=_ptr(i, f"<=> {target}"), watchman=N, target=target)], t2)
        i += 1

    if i >= N:
        t3 = base + [{"message": f"番兵に到達 → Target Not Found!", "color": "red"}]
        yield _f([_a("data", s, "Data", hl={i: "yellow"}, ptr=_ptr(i, "sentinel", "orange"), watchman=N, target=target)], t3, finished=True, found=False)
    else:
        t3 = base + [{"message": f"Found!   index = {i}", "color": "red"}]
        for _ in range(3):
            yield _f([_a("data", s, "Data", hl={i: "yellow"}, ptr=_ptr(i, f"<=> {target}"), watchman=N, target=target)], t3)
            yield _f([_a("data", s, "Data", hl={i: "#ff4444"}, ptr=_ptr(i, f"== {target}", "red"), watchman=N, target=target)], t3)
        yield _f([_a("data", s, "Data", hl={i: "#ff4444"}, watchman=N, target=target)], t3, finished=True, found=True)


# ---------------------------------------------------------------------------
# 線形探索 (整列済み配列)  ─ Liner_Search.demo03 相当
# ---------------------------------------------------------------------------

def linear_search_sorted(n, target=None, data=None):
    data = sorted(data) if data is not None else sorted([randint(1, _max_val(n)) for _ in range(n)])
    if target is None:
        target = _auto_target(data)
    N = len(data)
    base = [{"message": f"Sorted,   N = {N},   target = {target}", "color": "white"}]

    yield _f([_a("data", data, "Data (Sorted)", target=target)], base)

    for i in range(N):
        found = (data[i] == target)
        over  = (data[i] > target)
        cmp   = "==" if found else (">=" if over else "<")
        color = "red" if found else ("orange" if over else "lightgreen")
        t     = base + [{"message": f"data[{i}] = {data[i]}   {cmp}   {target}", "color": color}]

        if found:
            t2 = base + [{"message": f"Found!   index = {i}", "color": "red"}]
            for _ in range(3):
                yield _f([_a("data", data, "Data (Sorted)", hl={i: "yellow"}, ptr=_ptr(i, f">= {target}"), target=target)], t2)
                yield _f([_a("data", data, "Data (Sorted)", hl={i: "#ff4444"}, ptr=_ptr(i, f"== {target}", "red"), target=target)], t2)
            yield _f([_a("data", data, "Data (Sorted)", hl={i: "#ff4444"}, target=target)], t2, finished=True, found=True)
            return
        elif over:
            yield _f([_a("data", data, "Data (Sorted)", hl={i: "yellow"}, ptr=_ptr(i, f">= {target}"), target=target)], t)
            t3 = base + [{"message": f"data[{i}] = {data[i]} > {target} → Not Found!", "color": "red"}]
            yield _f([_a("data", data, "Data (Sorted)", hl={i: "yellow"}, target=target)], t3, finished=True, found=False)
            return

        yield _f([_a("data", data, "Data (Sorted)", hl={i: "yellow"}, ptr=_ptr(i, f">= {target}"), target=target)], t)

    t = base + [{"message": "Target Not Found! (end of array)", "color": "red"}]
    yield _f([_a("data", data, "Data (Sorted)", target=target)], t, finished=True, found=False)


# ---------------------------------------------------------------------------
# 二分探索 (反復)  ─ Binary_Search.demo01 相当
# ---------------------------------------------------------------------------

def binary_search(n, target=None, data=None):
    data = sorted(data) if data is not None else sorted([randint(1, _max_val(n)) for _ in range(n)])
    if target is None:
        target = _auto_target(data)
    N = len(data)
    base = [{"message": f"Sorted,   N = {N},   target = {target}", "color": "white"}]

    yield _f([_a("data", data, "Data (Sorted)", target=target)], base)

    first, last = 0, N - 1
    fills = []

    while first <= last:
        center = (first + last) // 2
        t = base + [
            {"message": f"first={first}  center={center}  last={last}", "color": "lightgreen"},
            {"message": f"data[{center}] = {data[center]}", "color": "cyan"},
        ]
        yield _f([_a("data", data, "Data (Sorted)",
                     hl={center: "yellow", first: "#aaffaa", last: "#aaffaa"},
                     fills=fills, ptr=_ptr(center, f"? {target}"), target=target)], t)

        if data[center] == target:
            t2 = base + [{"message": f"Found!   index = {center}", "color": "red"}]
            for _ in range(3):
                yield _f([_a("data", data, "Data (Sorted)", hl={center: "yellow"}, fills=fills,
                             ptr=_ptr(center, f"== {target}"), target=target)], t2)
                yield _f([_a("data", data, "Data (Sorted)", hl={center: "#ff4444"}, fills=fills,
                             ptr=_ptr(center, f"== {target}", "red"), target=target)], t2)
            yield _f([_a("data", data, "Data (Sorted)", hl={center: "#ff4444"}, fills=fills, target=target)], t2, finished=True, found=True)
            return
        elif target < data[center]:
            t3 = base + [{"message": f"{target} < data[{center}]={data[center]} → 左半分を探索", "color": "orange"}]
            fills = fills + [{"from": center, "to": last, "color": "#555555"}]
            last = center - 1
        else:
            t3 = base + [{"message": f"{target} > data[{center}]={data[center]} → 右半分を探索", "color": "orange"}]
            fills = fills + [{"from": first, "to": center, "color": "#555555"}]
            first = center + 1
        yield _f([_a("data", data, "Data (Sorted)", fills=fills, target=target)], t3)

    t = base + [{"message": "Target Not Found!", "color": "red"}]
    yield _f([_a("data", data, "Data (Sorted)", fills=fills, target=target)], t, finished=True, found=False)


# ---------------------------------------------------------------------------
# 二分探索 (再帰)  ─ Binary_Search.demo02 相当
# ---------------------------------------------------------------------------

def binary_search_recursive(n, target=None, data=None):
    data = sorted(data) if data is not None else sorted([randint(1, _max_val(n)) for _ in range(n)])
    if target is None:
        target = _auto_target(data)
    N = len(data)
    base = [{"message": f"Sorted,   N = {N},   target = {target}   (Recursive)", "color": "white"}]

    yield _f([_a("data", data, "Data (Sorted)", target=target)], base)

    def rec(first, last, fills, depth):
        if first > last:
            t = base + [{"message": f"depth={depth}: first={first} > last={last} → Not Found!", "color": "red"}]
            yield _f([_a("data", data, "Data (Sorted)", fills=fills, target=target)], t, finished=True, found=False)
            return

        center = (first + last) // 2
        t = base + [
            {"message": f"depth={depth}: first={first}  center={center}  last={last}", "color": "lightgreen"},
            {"message": f"data[{center}] = {data[center]}", "color": "cyan"},
        ]
        yield _f([_a("data", data, "Data (Sorted)",
                     hl={center: "yellow", first: "#aaffaa", last: "#aaffaa"},
                     fills=fills, ptr=_ptr(center, f"? {target}"), target=target)], t)

        if data[center] == target:
            t2 = base + [{"message": f"Found!   depth={depth},   index = {center}", "color": "red"}]
            for _ in range(3):
                yield _f([_a("data", data, "Data (Sorted)", hl={center: "yellow"}, fills=fills,
                             ptr=_ptr(center, f"== {target}"), target=target)], t2)
                yield _f([_a("data", data, "Data (Sorted)", hl={center: "#ff4444"}, fills=fills,
                             ptr=_ptr(center, f"== {target}", "red"), target=target)], t2)
            yield _f([_a("data", data, "Data (Sorted)", hl={center: "#ff4444"}, fills=fills, target=target)], t2, finished=True, found=True)
        elif target < data[center]:
            t3 = base + [{"message": f"depth={depth}: {target} < data[{center}] → 左へ再帰", "color": "orange"}]
            new_fills = fills + [{"from": center, "to": last, "color": "#555555"}]
            yield _f([_a("data", data, "Data (Sorted)", fills=new_fills, target=target)], t3)
            yield from rec(first, center - 1, new_fills, depth + 1)
        else:
            t3 = base + [{"message": f"depth={depth}: {target} > data[{center}] → 右へ再帰", "color": "orange"}]
            new_fills = fills + [{"from": first, "to": center, "color": "#555555"}]
            yield _f([_a("data", data, "Data (Sorted)", fills=new_fills, target=target)], t3)
            yield from rec(center + 1, last, new_fills, depth + 1)

    yield from rec(0, N - 1, [], 0)


# ---------------------------------------------------------------------------
# アルゴリズム一覧 / データサイズ一覧
# ---------------------------------------------------------------------------

AlgorithmList = [
    ("線形探索 (基本)",         linear_search,            {}),
    ("線形探索 (番兵法)",        linear_search_watchman,   {}),
    ("線形探索 (整列済み配列)",   linear_search_sorted,     {"sorted": True}),
    ("二分探索 (反復)",         binary_search,            {"sorted": True}),
    ("二分探索 (再帰)",         binary_search_recursive,  {"sorted": True}),
]

DataSizeList = [16, 32, 64, 100, 128, 200, 256, 512, 1024, 2048]

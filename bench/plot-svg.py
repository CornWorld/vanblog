#!/usr/bin/env python3
"""plot-svg.py — 纯标准库生成 SVG 图表（无 matplotlib/gnuplot 依赖）

用法: python3 plot-svg.py <results_dir> [out_chart.svg]

读取 results dir 的 *_run*.json（run-bench.sh 产物），生成两个并排图：
  左: Success rate % (分组柱状, 按 posts 分色, x=内存)
  右: Latency p99/p50 (按 posts 分线, x=内存)
纯标准库 → 自包含 SVG，可直接进 README/浏览器。
"""
import json, sys, os, glob, re
from collections import defaultdict

W, H = 1000, 360
ML, MT, RB, BB = 60, 50, 30, 60   # margins
PLOT_W = (W - ML - RB - 40) // 2  # each plot width
PLOT_H = H - MT - BB
POST_COLORS = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759"]


def load_runs(dirp):
    runs = []
    for f in sorted(glob.glob(os.path.join(dirp, "*_run*.json"))):
        try:
            d = json.load(open(f))
        except Exception:
            continue
        m = re.search(r"mem_(\S+)_posts_(\d+)", os.path.basename(f))
        if not m:
            continue
        d["mem"] = m.group(1)
        d["posts"] = int(m.group(2))
        runs.append(d)
    return runs


def mem_mb(mem):
    s = str(mem).lower()
    if s.endswith("g"):
        return int(float(s[:-1]) * 1024)
    if s.endswith("m"):
        return int(float(s[:-1]))
    return 0


def agg(runs):
    g = defaultdict(list)
    for r in runs:
        g[(r["mem"], r["posts"])].append(r)
    rows = []
    for (mem, posts), rs in g.items():
        med = lambda key: sorted([r.get(key, 0) or 0 for r in rs])[len(rs) // 2]
        lat = [r.get("latency_ms") or {} for r in rs]
        p99 = sorted([x.get("p99", 0) or 0 for x in lat])[len(lat) // 2]
        p50 = sorted([x.get("p50", 0) or 0 for x in lat])[len(lat) // 2]
        rows.append({
            "mem": mem, "posts": posts, "mem_mb": mem_mb(mem),
            "success": med("success_rate") * 100,
            "p99": p99, "p50": p50,
            "oom": any(r.get("server_oom_killed") for r in rs),
        })
    return rows


def x_map(mems):
    """map mem_mb -> x center within a plot"""
    if len(mems) == 1:
        return {mems[0]: 60}
    step = (PLOT_W - 60) / (len(mems) - 1)
    return {m: 30 + step * i for i, m in enumerate(sorted(mems))}


def main():
    d = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(d, "chart.svg")
    runs = load_runs(d)
    if not runs:
        print("no results in", d)
        sys.exit(1)
    rows = agg(runs)
    posts_set = sorted(set(r["posts"] for r in rows))
    mems = sorted(set(r["mem_mb"] for r in rows))
    xm = x_map(mems)
    maxlat = max([r["p99"] for r in rows] + [1])

    E = []  # svg elements
    E_add = E.append

    def txt(x, y, s, size=12, anchor="start", weight="normal", fill="#333"):
        E_add(f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" '
              f'font-weight="{weight}" fill="{fill}"><tspan xml:space="preserve">{s}</tspan></text>')

    def y_v(v, mx):
        return MT + PLOT_H - (v / mx) * PLOT_H

    # ── Chart 1: Success % ──
    ox = ML
    txt(ox, MT - 20, "Success rate (%)", 15, weight="bold")
    for gv in (0, 50, 100):
        gy = y_v(gv, 100)
        E_add(f'<line x1="{ox}" y1="{gy}" x2="{ox+PLOT_W}" y2="{gy}" stroke="#e5e5e5"/>')
        E_add(f'<text x="{ox-6}" y="{gy+4}" text-anchor="end" font-size="10" fill="#888">{gv}</text>')
    for post in posts_set:
        color = POST_COLORS[posts_set.index(post) % len(POST_COLORS)]
        items = [r for r in rows if r["posts"] == post and not r["oom"]]
        bw = 16
        for i, r in enumerate(sorted(items, key=lambda x: x["mem_mb"])):
            bx = xm[r["mem_mb"]] - 20 + i * (bw + 3)
            bh = r["success"] / 100 * PLOT_H
            fb = "#e15759" if r["success"] < 95 else color
            E_add(f'<rect x="{bx}" y="{y_v(r["success"],100)}" width="{bw}" height="{max(bh,1)}" '
              f'fill="{fb}" opacity="0.85"><title>{r["mem"]}/{r["posts"]}posts: {r["success"]:.1f}%</title></rect>')
            E_add(f'<text x="{bx+bw/2}" y="{y_v(r["success"],100)+bh+12}" text-anchor="middle" font-size="9">{r["success"]:.0f}</text>')
        if items:
            E_add(f'<text x="{xm[items[0]["mem_mb"]]-20}" y="{MT+PLOT_H+16}" text-anchor="middle" font-size="11" fill="{color}">{post} posts</text>')
    for m, xx in xm.items():
        E_add(f'<text x="{xx}" y="{MT+PLOT_H+34}" text-anchor="middle" font-size="11">{m}MB</text>')

    # ── Chart 2: Latency ──
    ox2 = ML + PLOT_W + 40
    txt(ox2, MT - 20, "Latency (ms)  — =p99  ..=p50", 15, weight="bold")
    for gv in (0, maxlat / 2, maxlat):
        gy = y_v(gv, maxlat)
        E_add(f'<line x1="{ox2}" y1="{gy}" x2="{ox2+PLOT_W}" y2="{gy}" stroke="#e5e5e5"/>')
        E_add(f'<text x="{ox2-6}" y="{gy+4}" text-anchor="end" font-size="12" fill="#888">{gv:.0f}</text>')
    # p99 axis labels
    for m, xx in xm.items():
        E_add(f'<text x="{ox2+xx}" y="{MT+PLOT_H+34}" text-anchor="middle" font-size="11">{m}MB</text>')
    for post in posts_set:
        color = POST_COLORS[posts_set.index(post) % len(POST_COLORS)]
        items = sorted([r for r in rows if r["posts"] == post], key=lambda r: r["mem_mb"])
        if not items:
            continue
        pts = " ".join(f"{ox2+xm[r['mem_mb']]},{y_v(r['p99'],maxlat)}" for r in items)
        E_add(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="2"/>')
        pts2 = " ".join(f"{ox2+xm[r['mem_mb']]},{y_v(r['p50'],maxlat)}" for r in items)
        E_add(f'<polyline points="{pts2}" fill="none" stroke="{color}" stroke-width="1.5" stroke-dasharray="4,3"/>')
        mv = items[0]["mem_mb"]
        E_add(f'<text x="{ox2+items[0]["mem_mb"]-20}" y="{MT-6}" font-size="11" fill="{color}">|–{post} posts</text>')

    # OOM marks
    for r in rows:
        if r["oom"]:
            txt(xm[r["mem_mb"]], y_v(r["p99"], maxlat) + oy2 if False else MT + PLOT_H - 10,
                "OOM", 12, fill="#c0392b")

    # table of numeric results
    ty = H - 48
    txt(ML, ty, "mem  posts  success%   p50    p99   oom", 12, weight="bold")
    for r in sorted(rows, key=lambda x: (x["mem_mb"], x["posts"])):
        ty += 18
        txt(ML, ty, f'{r["mem"]:>4}×{r["posts"]:<4} {r["success"]:>7.1f}% {r["p50"]:>7.1f} {r["p99"]:>7.1f} {"YES" if r["oom"] else "no":>4}', 11)

    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H+30}">' + "".join(E) + "</svg>"
    open(out, "w").write(svg)
    print(f"SVG → {out}")
    for r in sorted(rows, key=lambda x: (x["mem_mb"], x["posts"])):
        print(f"  {r['mem']:>4}×{r['posts']:<4} {r['success']:>6.1f}%  p50={r['p50']:>6.1f}  p99={r['p99']:>6.1f}  oom={'YES' if r['oom'] else 'no'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python3 plot-svg.py <results_dir> [out.svg]")
        sys.exit(1)
    main()
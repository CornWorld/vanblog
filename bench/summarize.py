#!/usr/bin/env python3
"""summarize.py — 汇总 run-bench.sh 的结果目录，输出汇总 CSV + 生成图表

用法: python3 summarize.py <results_dir> [--csv out.csv] [--plot out.png]

输入: results/<ts>/*.json — 每文件是 run-bench.sh 一轮的结果
输出:
  - 控制台汇总表（中位数 over repeats）
  - CSV（可选）
  - 图表 PNG（可选）：
      1. QPS vs 内存限制（按 posts 分线）
      2. p99 latency vs 内存限制（按 posts 分线）
      3. OOM 标记（内存不足的运行标红）
"""

import json, sys, os
import glob
from collections import defaultdict
from statistics import median

def load_results(dirpath):
    runs = []
    for f in glob.glob(os.path.join(dirpath, "*.json")):
        try:
            with open(f) as fh:
                d = json.load(fh)
        except Exception as e:
            print(f"  skip {f}: {e}", file=sys.stderr)
            continue
        # 解析文件名 mem_1g_posts_50_run1.json
        base = os.path.basename(f)
        parts = base.replace(".json", "").split("_")
        mem = postcount = run = None
        for i, p in enumerate(parts):
            if p == "mem": mem = parts[i+1]
            if p == "posts": postcount = int(parts[i+1])
            if p.startswith("run"): run = int(p[3:])
        if not d.get("actual_qps"): continue
        d.update(mem=mem, posts=postcount, run=run)
        runs.append(d)
    return runs

def summarize(runs):
    """按 (mem, posts) 分组，取中位数"""
    groups = defaultdict(list)
    for r in runs:
        groups[(r["mem"], r["posts"])].append(r)
    rows = []
    for (mem, posts), rs in sorted(groups.items()):
        rs_sorted = sorted(rs, key=lambda r: r.get("actual_qps", 0) or 0)
        n = len(rs)
        med = rs_sorted[max(0, n//2 - 1)] if n else None
        # 中位数（偶数取下中位，逼近真中位）
        if med is None: continue
        rows.append({
            "mem": mem, "posts": posts, "runs": n,
            "qps_med": med.get("actual_qps", 0),
            "qps_min": min((r.get("actual_qps") or 0) for r in rs),
            "qps_max": max((r.get("actual_qps") or 0) for r in rs),
            "success_med": (med.get("success_rate") or 0) * 100,
            "p99_med": med.get("latency_ms", {}).get("p99", 0),
            "p50_med": med.get("latency_ms", {}).get("p50", 0),
            "oom": any(r.get("server_oom_killed") for r in rs),
            "bytes_med": med.get("bytes_transferred", 0),
        })
    return rows

def pprint(rows):
    print(f"{'mem':<6}{'posts':<7}{'runs':<6}{'qps_med':<9}{'qps_range':<18}{'ok%':<8}{'p50':<7}{'p99':<7}{'oom':<6}")
    for r in rows:
        qps_range = f"{r['qps_min']:.0f}-{r['qps_max']:.0f}"
        print(f"{r['mem']:<6}{r['posts']:<7}{r['runs']:<6}{r['qps_med']:<9.0f}{qps_range:<18}{r['success_med']:<8.1f}{r['p50_med']:<7.1f}{r['p99_med']:<7.1f}{'YES' if r['oom'] else 'no':<6}")
    print(f"\n{len(rows)} configs, {sum(r['runs'] for r in rows)} runs total")

def to_csv(rows, path):
    import csv
    keys = ["mem","posts","runs","qps_med","qps_min","qps_max","success_med","p50_med","p99_med","oom","bytes_med"]
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print(f"CSV → {path}")

def mb(v):
    return v / (1024*1024)

def plot(rows, path):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed — skip plot", file=sys.stderr)
        return False

    # 内存限制 规范化到 MB 数字
    mem_mb = {"512m": 512, "1g": 1024, "2g": 2048, "4g": 4096, "8g": 8192}
    posts_set = sorted(set(r["posts"] for r in rows))

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # --- 图1: QPS vs 内存限制 ---
    ax = axes[0]
    for p in posts_set:
        pr = [r for r in rows if r["posts"] == p]
        pr.sort(key=lambda r: mem_mb.get(r["mem"], 0))
        xs = [mem_mb.get(r["mem"], 0) for r in pr]
        ys = [r["qps_med"] for r in pr]
        marker = "o"
        ax.plot(xs, ys, marker=marker, label=f"{p} posts")
        # 误差带
        low = [r["qps_min"] for r in pr]
        hi = [r["qps_max"] for r in pr]
        ax.fill_between(xs, low, hi, alpha=0.2)
        # OOM 标红
        for r in pr:
            if r["oom"]:
                ax.scatter(mem_mb.get(r["mem"], 0), r["qps_med"], color="red", marker="x", s=120, zorder=5)
    ax.axhline(1000, color="gray", ls="--", lw=0.8)
    ax.text(0.98, 0.95, "target 1000 QPS", transform=ax.transAxes, ha="right", va="top", fontsize=9, color="gray")
    ax.set_xlabel("memory limit (MB)")
    ax.set_ylabel("throughput (QPS, median)")
    ax.set_title("Throughput vs Memory Limit")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # --- 图2: p99 vs 内存限制 ---
    ax = axes[1]
    for p in posts_set:
        pr = [r for r in rows if r["posts"] == p]
        pr.sort(key=lambda r: mem_mb.get(r["mem"], 0))
        xs = [mem_mb.get(r["mem"], 0) for r in pr]
        ys = [r["p99_med"] for r in pr]
        ax.plot(xs, ys, marker="s", label=f"{p} posts")
    ax.set_xlabel("memory limit (MB)")
    ax.set_ylabel("p99 latency (ms)")
    ax.set_title("p99 Latency vs Memory Limit")
    ax.legend()
    ax.grid(True, alpha=0.3)

    fig.tight_layout()
    fig.savefig(path, dpi=150)
    print(f"plot → {path}")
    return True

if __name__ == "__main__":
    dirp = sys.argv[1]
    runs = load_results(dirp)
    if not runs:
        print("no results found")
        sys.exit(1)
    rows = summarize(runs)
    pprint(rows)
    if "--csv" in sys.argv:
        to_csv(rows, sys.argv[sys.argv.index("--csv")+1])
    if "--plot" in sys.argv:
        plot(rows, sys.argv[sys.argv.index("--plot")+1])
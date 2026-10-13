#!/usr/bin/env python3
"""Homepage load benchmark: original van-blog (Next.js SSR :13000) vs vanblog rewrite (Astro SSR via Caddy :18080).

Both homepages serve 10 identical corpus posts, warm cache, empty comments.

Usage: python3 benchmark2.py <outfile.json>
"""
import json
import statistics
import sys
import time
import urllib.request
import concurrent.futures

ORIG = "http://127.0.0.1:13000/"
NEW = "http://127.0.0.1:18080/"


def get_mem_mb(name):
    out = __import__("subprocess").run(
        ["docker", "stats", "--no-stream", "--format", "{{.MemUsage}}", name],
        capture_output=True, text=True).stdout.strip()
    part = out.split("/")[0].strip()
    if "GiB" in part:
        return round(float(part.replace("GiB", "")) * 1024, 1)
    if "MiB" in part:
        return round(float(part.replace("MiB", "")), 1)
    return 0.0


def fetch(url):
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "bench"}), timeout=10) as r:
            r.read()
            return (time.perf_counter() - t0) * 1000, True
    except Exception:
        return 0.0, False


def run(url, n, c):
    lat, errs = [], 0
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=c) as ex:
        for ms, ok in ex.map(lambda _: fetch(url), range(n)):
            if ok:
                lat.append(ms)
            else:
                errs += 1
    dur = time.perf_counter() - t0
    lat.sort()
    def pct(p):
        return lat[min(len(lat) - 1, int(len(lat) * p))] if lat else 0
    return {
        "n": n, "c": c, "errors": errs, "dur_s": round(dur, 3),
        "qps": round(n / dur, 1),
        "avg_ms": round(statistics.mean(lat), 2) if lat else 0,
        "p50_ms": round(pct(0.50), 2),
        "p95_ms": round(pct(0.95), 2),
        "p99_ms": round(pct(0.99), 2),
        "max_ms": round(lat[-1], 2) if lat else 0,
    }


def main():
    outfile = sys.argv[1] if len(sys.argv) > 1 else "results2.json"
    res = {}

    # warmup
    for _ in range(20):
        fetch(ORIG)
        fetch(NEW)

    # sequential latency, 3 rounds
    print("[seq latency n=100]")
    res["seq"] = {"orig": [], "new": []}
    for r in range(3):
        res["seq"]["orig"].append(run(ORIG, 100, 1))
        res["seq"]["new"].append(run(NEW, 100, 1))
        print(f"  r{r+1} orig avg={res['seq']['orig'][-1]['avg_ms']}ms  new avg={res['seq']['new'][-1]['avg_ms']}ms")

    # c=20 n=500 x3
    print("[load c=20 n=500 x3]")
    res["c20"] = {"orig": [], "new": []}
    for r in range(3):
        res["c20"]["orig"].append(run(ORIG, 500, 20))
        res["c20"]["new"].append(run(NEW, 500, 20))
        print(f"  r{r+1} orig qps={res['c20']['orig'][-1]['qps']} p95={res['c20']['orig'][-1]['p95_ms']}ms | new qps={res['c20']['new'][-1]['qps']} p95={res['c20']['new'][-1]['p95_ms']}ms")

    # c=50 n=1000 x3
    print("[load c=50 n=1000 x3]")
    res["c50"] = {"orig": [], "new": []}
    for r in range(3):
        res["c50"]["orig"].append(run(ORIG, 1000, 50))
        res["c50"]["new"].append(run(NEW, 1000, 50))
        print(f"  r{r+1} orig qps={res['c50']['orig'][-1]['qps']} p95={res['c50']['orig'][-1]['p95_ms']}ms | new qps={res['c50']['new'][-1]['qps']} p95={res['c50']['new'][-1]['p95_ms']}ms")

    res["mem_steady_mb"] = {
        "orig_app": get_mem_mb("exp-orig-app"),
        "orig_mongo": get_mem_mb("exp-orig-mongo"),
        "new": get_mem_mb("exp-new-app"),
    }

    def med(runs, k):
        return round(statistics.median(x[k] for x in runs), 2)

    summary = {}
    for k in ("c20", "c50"):
        summary[k] = {
            "orig_qps": med(res[k]["orig"], "qps"),
            "new_qps": med(res[k]["new"], "qps"),
            "orig_p95": med(res[k]["orig"], "p95_ms"),
            "new_p95": med(res[k]["new"], "p95_ms"),
            "orig_avg": med(res[k]["orig"], "avg_ms"),
            "new_avg": med(res[k]["new"], "avg_ms"),
        }
    summary["seq_avg_orig"] = med(res["seq"]["orig"], "avg_ms")
    summary["seq_avg_new"] = med(res["seq"]["new"], "avg_ms")
    summary["mem"] = res["mem_steady_mb"]
    res["summary"] = summary
    with open(outfile, "w") as f:
        json.dump(res, f, indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

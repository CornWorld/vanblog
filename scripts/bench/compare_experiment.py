import subprocess
import time
import json
import statistics
import urllib.request
import urllib.error
import concurrent.futures
import os
import sys

def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, shell=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {cmd}\n{res.stderr}")
    return res.stdout.strip()

def get_container_mem_bytes(name):
    out = run_cmd(f"docker stats --no-stream --format '{{{{.MemUsage}}}}' {name}")
    part = out.split('/')[0].strip()
    if 'GiB' in part:
        return float(part.replace('GiB','').strip()) * 1024 * 1024 * 1024
    elif 'MiB' in part:
        return float(part.replace('MiB','').strip()) * 1024 * 1024
    elif 'KiB' in part:
        return float(part.replace('KiB','').strip()) * 1024
    return 0.0

def get_process_breakdown(name):
    try:
        out = run_cmd(f"docker exec {name} ps -o pid,user,rss,comm -A", check=False)
        lines = out.splitlines()
        procs = []
        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 4:
                procs.append({
                    "pid": parts[0],
                    "user": parts[1],
                    "rss_kb": parts[2],
                    "comm": " ".join(parts[3:])
                })
        return procs
    except Exception:
        return []

def wait_for_http(url, timeout=45):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Bench/1.0'})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status in (200, 302):
                    return time.time() - t0
        except Exception:
            pass
        time.sleep(0.1)
    raise TimeoutError(f"Timed out waiting for {url}")

def measure_cold_start_orig():
    run_cmd("docker rm -f exp-orig-app exp-orig-mongo 2>/dev/null || true", check=False)
    t0 = time.time()
    run_cmd("docker run -d --name exp-orig-mongo --network exp-orig-net -v /home/ubuntu/exp-compare/data-orig/mongo:/data/db mongo:4.4")
    # Wait for mongo
    for _ in range(30):
        if subprocess.run("docker exec exp-orig-mongo mongo --eval 'db.runCommand({ ping: 1 })'", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(0.2)
    run_cmd("""docker run -d --name exp-orig-app --network exp-orig-net -p 127.0.0.1:13000:3000 -e VAN_BLOG_DATABASE_URL='mongodb://exp-orig-mongo:27017/vanBlog?authSource=admin' -e VAN_BLOG_ALLOW_DOMAINS='' -e EMAIL='test@example.com' -v /home/ubuntu/exp-compare/data-orig/app:/app/static mereith/van-blog:latest""")
    _ = wait_for_http("http://127.0.0.1:13000/")
    return time.time() - t0

def measure_cold_start_new():
    run_cmd("docker rm -f exp-new-app 2>/dev/null || true", check=False)
    t0 = time.time()
    run_cmd("""docker run -d --name exp-new-app -p 127.0.0.1:18080:80 -e VANBLOG_HTTP_ONLY=1 -e VANBLOG_EMAIL='test@example.com' -v /home/ubuntu/exp-compare/data-new:/data ghcr.io/cornworld/vanblog:prod-latest""")
    _ = wait_for_http("http://127.0.0.1:18080/")
    return time.time() - t0

def benchmark_latency(url, count=100):
    latencies = []
    errors = 0
    for _ in range(count):
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Bench/1.0'})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                _ = resp.read()
                latencies.append((time.perf_counter() - t0) * 1000)
        except Exception:
            errors += 1
    return {
        "count": count,
        "errors": errors,
        "min": min(latencies) if latencies else 0,
        "avg": statistics.mean(latencies) if latencies else 0,
        "median": statistics.median(latencies) if latencies else 0,
        "p95": statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0),
        "p99": statistics.quantiles(latencies, n=100)[98] if len(latencies) >= 100 else (max(latencies) if latencies else 0),
        "max": max(latencies) if latencies else 0,
    }

def benchmark_concurrent(url, concurrency=20, total=500):
    latencies = []
    errors = 0
    t_start = time.perf_counter()
    
    def fetch():
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Bench/1.0'})
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                _ = resp.read()
                return (time.perf_counter() - t0) * 1000, True
        except Exception:
            return 0.0, False

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(fetch) for _ in range(total)]
        for f in concurrent.futures.as_completed(futures):
            lat, ok = f.result()
            if ok:
                latencies.append(lat)
            else:
                errors += 1
    total_duration = time.perf_counter() - t_start
    qps = total / total_duration if total_duration > 0 else 0

    return {
        "total": total,
        "concurrency": concurrency,
        "duration_s": total_duration,
        "qps": qps,
        "errors": errors,
        "avg": statistics.mean(latencies) if latencies else 0,
        "median": statistics.median(latencies) if latencies else 0,
        "p95": statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else (max(latencies) if latencies else 0),
        "max": max(latencies) if latencies else 0,
    }

def main():
    print("=== Starting Rigorous Benchmark Experiment ===", flush=True)
    results = {}

    # 1. Cold start measurements (3 rounds)
    print("\n[Phase 1] Measuring Cold Start Time (3 runs each)...", flush=True)
    orig_cold = []
    new_cold = []
    for r in range(3):
        print(f"  Round {r+1}/3: Testing Stack B (New)...", flush=True)
        c_new = measure_cold_start_new()
        new_cold.append(c_new)
        print(f"    New ready in: {c_new:.2f}s", flush=True)
        
        print(f"  Round {r+1}/3: Testing Stack A (Orig)...", flush=True)
        c_orig = measure_cold_start_orig()
        orig_cold.append(c_orig)
        print(f"    Orig ready in: {c_orig:.2f}s", flush=True)
        time.sleep(2)

    results["cold_start"] = {
        "orig_runs": orig_cold,
        "orig_mean": statistics.mean(orig_cold),
        "new_runs": new_cold,
        "new_mean": statistics.mean(new_cold)
    }

    # Settle down for memory measurement
    print("\n[Phase 2] Waiting 15s for steady-state memory...", flush=True)
    time.sleep(15)

    mem_orig_app = get_container_mem_bytes("exp-orig-app")
    mem_orig_mongo = get_container_mem_bytes("exp-orig-mongo")
    mem_orig_total = mem_orig_app + mem_orig_mongo
    mem_new = get_container_mem_bytes("exp-new-app")

    results["memory_steady"] = {
        "orig_app_mb": mem_orig_app / (1024*1024),
        "orig_mongo_mb": mem_orig_mongo / (1024*1024),
        "orig_total_mb": mem_orig_total / (1024*1024),
        "new_total_mb": mem_new / (1024*1024),
    }
    print(f"  Steady Memory - Orig Total: {mem_orig_total/(1024*1024):.1f} MB (App: {mem_orig_app/(1024*1024):.1f} MB, Mongo: {mem_orig_mongo/(1024*1024):.1f} MB)", flush=True)
    print(f"  Steady Memory - New Total: {mem_new/(1024*1024):.1f} MB", flush=True)

    results["procs_orig"] = get_process_breakdown("exp-orig-app")
    results["procs_new"] = get_process_breakdown("exp-new-app")

    # 3. Latency test (Sequential 100 requests)
    print("\n[Phase 3] Measuring Sequential Request Latency (100 requests)...", flush=True)
    lat_orig = benchmark_latency("http://127.0.0.1:13000/", count=100)
    lat_new = benchmark_latency("http://127.0.0.1:18080/", count=100)
    results["latency_seq"] = {
        "orig": lat_orig,
        "new": lat_new
    }
    print(f"  Orig: avg={lat_orig['avg']:.2f}ms, p50={lat_orig['median']:.2f}ms, p95={lat_orig['p95']:.2f}ms", flush=True)
    print(f"  New:  avg={lat_new['avg']:.2f}ms, p50={lat_new['median']:.2f}ms, p95={lat_new['p95']:.2f}ms", flush=True)

    # 4. Concurrency load test (20 concurrency, 500 requests)
    print("\n[Phase 4] Measuring Concurrency Load (c=20, n=500)...", flush=True)
    load_orig = benchmark_concurrent("http://127.0.0.1:13000/", concurrency=20, total=500)
    load_new = benchmark_concurrent("http://127.0.0.1:18080/", concurrency=20, total=500)
    results["load_test"] = {
        "orig": load_orig,
        "new": load_new
    }
    print(f"  Orig: QPS={load_orig['qps']:.1f}, avg={load_orig['avg']:.2f}ms, p95={load_orig['p95']:.2f}ms, err={load_orig['errors']}", flush=True)
    print(f"  New:  QPS={load_new['qps']:.1f}, avg={load_new['avg']:.2f}ms, p95={load_new['p95']:.2f}ms, err={load_new['errors']}", flush=True)

    # Check post-load memory
    mem_orig_post = (get_container_mem_bytes("exp-orig-app") + get_container_mem_bytes("exp-orig-mongo")) / (1024*1024)
    mem_new_post = get_container_mem_bytes("exp-new-app") / (1024*1024)
    results["memory_post_load"] = {
        "orig_total_mb": mem_orig_post,
        "new_total_mb": mem_new_post
    }
    print(f"  Post-load Memory - Orig: {mem_orig_post:.1f} MB, New: {mem_new_post:.1f} MB", flush=True)

    # Save results
    out_file = "/home/ubuntu/exp-compare/results.json"
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n=== Experiment Finished! Saved to {out_file} ===", flush=True)

if __name__ == "__main__":
    main()

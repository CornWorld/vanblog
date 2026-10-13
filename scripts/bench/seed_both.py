#!/usr/bin/env python3
"""Seed identical corpus content into original van-blog and vanblog (rewrite).

Reads bench/corpus.jsonl (HN/arXiv-derived real text), creates N posts in both
instances so the homepage load test compares equal content.

Usage: python3 seed_both.py <corpus.jsonl> <count>
"""
import json
import sys
import urllib.request

ORIG = "http://127.0.0.1:13000"
NEW = "http://127.0.0.1:18080"
ORIG_USER = {"username": "admin", "password": "bench12345"}
NEW_USER = {"email": "bench@example.com", "password": "benchpass123"}


def req_json(url, body=None, headers=None, method=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, headers=h, method=method or ("POST" if data else "GET"))
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return json.loads(resp.read())


def main():
    corpus_path = sys.argv[1]
    count = int(sys.argv[2])
    items = []
    with open(corpus_path) as f:
        for line in f:
            try:
                items.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    # deterministic subset: take first `count` with longest-ish bodies
    items = items[:count * 3]
    items.sort(key=lambda x: len(x.get("text") or x.get("title") or ""), reverse=True)
    items = items[:count][::-1]

    # --- login both ---
    tok_o = req_json(f"{ORIG}/api/admin/auth/login", ORIG_USER)["data"]["token"]
    tok_n = req_json(f"{NEW}/api/collections/users/auth-with-password",
                     {"identity": NEW_USER["email"], "password": NEW_USER["password"]})["token"]
    ha = {"token": tok_o}
    hn = {"Authorization": tok_n}

    # --- category in both ---
    req_json(f"{ORIG}/api/admin/category", {"name": "Tech", "value": "tech"}, headers=ha)
    cat_n = req_json(f"{NEW}/api/collections/categories/records", {"name": "Tech", "value": "tech"}, headers=hn)

    # --- posts in both ---
    ok_o = ok_n = 0
    for i, it in enumerate(items):
        title = (it.get("title") or f"Bench post {i}").strip()[:120]
        text = (it.get("text") or "").strip()
        if len(text) < 200:
            text = (text + "\n\n" + text * 3).strip()
        body_o = {
            "title": title, "content": text, "category": "Tech",
            "tags": ["bench"], "pathname": f"bench-{i}", "top": 0,
            "hidden": False, "private": False,
        }
        try:
            req_json(f"{ORIG}/api/admin/article", body_o, headers=ha)
            ok_o += 1
        except Exception as e:
            print(f"orig post {i} ERR: {e}")
        body_n = {
            "title": title, "content": text, "status": "published",
            "pathname": f"bench-{i}", "top": 0, "private": False,
            "category": cat_n["id"], "deleted": False,
        }
        try:
            req_json(f"{NEW}/api/collections/posts/records", body_n, headers=hn)
            ok_n += 1
        except Exception as e:
            print(f"new post {i} ERR: {e}")
    print(f"seeded orig={ok_o} new={ok_n}")


if __name__ == "__main__":
    main()

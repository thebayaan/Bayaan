#!/usr/bin/env python3
"""
Enqueue migration tasks to Cloudflare Queue.

This script pushes all file migration tasks into the cloud queue,
then your laptop can close. The Worker processes everything server-side.

Usage:
  python3 scripts/enqueue-migration.py                        # Enqueue all
  python3 scripts/enqueue-migration.py --source mp3quran      # mp3quran only
  python3 scripts/enqueue-migration.py --source supabase      # Supabase only
  python3 scripts/enqueue-migration.py --dry-run              # Preview only
  python3 scripts/enqueue-migration.py --status               # Check progress
  python3 scripts/enqueue-migration.py --reset-status         # Reset counters
"""

import json
import os
import sys
import argparse
import re
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
RECITERS_JSON = PROJECT_DIR / "data" / "reciters.json"
SLUGS_JSON = PROJECT_DIR / "data" / "rewayat-slugs.json"
ENV_FILE = PROJECT_DIR / ".env.r2-worker"

ENQUEUE_BATCH_SIZE = 500  # files per /enqueue request (chunked to 100 internally by Worker)


def load_env():
    if not ENV_FILE.exists():
        print(f"Missing {ENV_FILE}")
        sys.exit(1)
    env = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip()
    return env


def load_slug_mappings():
    with open(SLUGS_JSON) as f:
        data = json.load(f)
    return data["rewayat"], data["styles"]


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = slug.replace("'", "").replace("\u2019", "").replace("`", "")
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug


def build_migration_plan(reciters, rewayat_slugs, style_slugs, source_filter=None):
    """Build flat list of all files to migrate."""
    tasks = []
    occupied = {}

    for source_pass in ["supabase", "mp3quran"]:
        for reciter in reciters:
            name = reciter.get("name", "")
            reciter_slug = slugify(name)

            for rw in reciter.get("rewpiayat", reciter.get("rewayat", [])):
                server = rw.get("server", "")

                if source_pass == "supabase" and "supabase" not in server:
                    continue
                if source_pass == "mp3quran" and "mp3quran" not in server:
                    continue
                if source_filter and source_filter != source_pass:
                    continue

                rewayah_slug = rewayat_slugs.get(rw.get("name", ""))
                if not rewayah_slug:
                    continue

                style_slug = style_slugs.get(rw.get("style", "murattal"), "murattal")
                key = (reciter_slug, rewayah_slug, style_slug)
                existing = occupied.get(key, [])

                if source_pass == "supabase":
                    edition = "default"
                else:
                    edition = "default" if not existing else f"alt-{len(existing)}"

                occupied.setdefault(key, []).append(edition)

                surah_list = rw.get("surah_list", "")
                if isinstance(surah_list, str):
                    surah_list = [s.strip() for s in surah_list.split(",") if s.strip()]

                prefix = f"quran/recitations/{reciter_slug}/{rewayah_slug}/{style_slug}/{edition}"
                server_clean = server.rstrip("/")

                for surah in surah_list:
                    if surah is None or str(surah) == "None":
                        continue
                    padded = str(surah).zfill(3)
                    tasks.append({
                        "source_url": f"{server_clean}/{padded}.mp3",
                        "r2_key": f"{prefix}/{padded}.mp3",
                    })

    return tasks


def worker_request(worker_url, auth_token, endpoint, payload=None, method="POST"):
    url = f"{worker_url.rstrip('/')}{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}",
            "User-Agent": "Bayaan-R2-Migrator/1.0",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return {"error": f"HTTP {e.code}: {body}"}
    except Exception as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Enqueue migration tasks to Cloudflare Queue")
    parser.add_argument("--source", choices=["supabase", "mp3quran"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--status", action="store_true", help="Check migration progress")
    parser.add_argument("--reset-status", action="store_true", help="Reset progress counters")
    args = parser.parse_args()

    env = load_env()
    worker_url = env["WORKER_URL"]
    auth_token = env["AUTH_TOKEN"]

    if args.status:
        result = worker_request(worker_url, auth_token, "/status", method="GET")
        if "error" in result:
            print(f"Error: {result['error']}")
            return
        print(f"Migration Status:")
        print(f"  Enqueued:   {result['enqueued']}")
        print(f"  Processed:  {result['processed']}")
        print(f"  Succeeded:  {result['succeeded']}")
        print(f"  Failed:     {result['failed']}")
        print(f"  Remaining:  {result['remaining']}")
        print(f"  Progress:   {result['percent_done']}%")
        return

    if args.reset_status:
        result = worker_request(worker_url, auth_token, "/status/reset")
        print(f"Status counters reset: {result}")
        return

    # Build plan
    rewayat_slugs, style_slugs = load_slug_mappings()
    with open(RECITERS_JSON) as f:
        reciters = json.load(f)

    files = build_migration_plan(reciters, rewayat_slugs, style_slugs, args.source)
    print(f"Total files to enqueue: {len(files)}")

    if args.dry_run:
        # Show summary by prefix
        prefixes = {}
        for f in files:
            prefix = "/".join(f["r2_key"].split("/")[:-1])
            prefixes[prefix] = prefixes.get(prefix, 0) + 1
        for prefix, count in sorted(prefixes.items()):
            print(f"  {prefix}/ — {count} files")
        print(f"\nTotal: {len(prefixes)} prefixes, {len(files)} files")
        return

    # Health check
    print("Checking Worker health... ", end="", flush=True)
    health = worker_request(worker_url, auth_token, "/health", method="GET")
    if health.get("status") != "ok":
        print(f"FAILED: {health}")
        sys.exit(1)
    print("ok")

    # Reset counters
    worker_request(worker_url, auth_token, "/status/reset")
    print("Status counters reset.")

    # Enqueue in batches
    total_enqueued = 0
    for i in range(0, len(files), ENQUEUE_BATCH_SIZE):
        batch = files[i:i + ENQUEUE_BATCH_SIZE]
        batch_num = (i // ENQUEUE_BATCH_SIZE) + 1
        total_batches = (len(files) + ENQUEUE_BATCH_SIZE - 1) // ENQUEUE_BATCH_SIZE

        result = worker_request(worker_url, auth_token, "/enqueue", {"files": batch})

        if "error" in result:
            print(f"  Batch {batch_num}/{total_batches}: ERROR — {result['error']}")
        else:
            enqueued = result.get("enqueued", 0)
            total_enqueued += enqueued
            print(f"  Batch {batch_num}/{total_batches}: {enqueued} enqueued (total: {total_enqueued})")

    print(f"\nDone! {total_enqueued} files enqueued.")
    print(f"The Worker will process them server-side. You can close your laptop.")
    print(f"\nCheck progress anytime:")
    print(f"  python3 scripts/enqueue-migration.py --status")
    print(f"  # or via curl:")
    print(f"  curl -H 'Authorization: Bearer {auth_token}' -H 'User-Agent: Bayaan-R2-Migrator/1.0' {worker_url}/status")


if __name__ == "__main__":
    main()

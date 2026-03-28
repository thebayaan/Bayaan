#!/usr/bin/env python3
"""
Cloudflare Worker-based R2 Migration
=====================================

Uses a Cloudflare Worker for server-side transfer:
  mp3quran (Bunny CDN) → Cloudflare Worker → R2 bucket

Your machine only sends the instructions — bytes never touch your network.

Prerequisites:
  - Deploy the Worker: cd workers/r2-migrator && npx wrangler deploy
  - Set the auth secret: npx wrangler secret put AUTH_TOKEN
  - Create .env.r2-worker with WORKER_URL and AUTH_TOKEN

Usage:
  python3 scripts/migrate-to-r2-worker.py --dry-run              # Preview
  python3 scripts/migrate-to-r2-worker.py --source mp3quran      # mp3quran only
  python3 scripts/migrate-to-r2-worker.py --source supabase      # Supabase only
  python3 scripts/migrate-to-r2-worker.py                        # Everything
  python3 scripts/migrate-to-r2-worker.py --batch-size 30        # Adjust batch size
"""

import json
import os
import sys
import argparse
import re
import time
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
RECITERS_JSON = PROJECT_DIR / "data" / "reciters.json"
SLUGS_JSON = PROJECT_DIR / "data" / "rewayat-slugs.json"
ENV_FILE = PROJECT_DIR / ".env.r2-worker"

DEFAULT_BATCH_SIZE = 10  # files per Worker request (max 50)
CONCURRENT_BATCHES = 2   # parallel Worker requests
MAX_RETRIES = 3          # retry failed batches
LOG_FILE = PROJECT_DIR / "migration-log.json"


def load_env():
    if not ENV_FILE.exists():
        print(f"Missing {ENV_FILE}")
        print("Create it with:")
        print("  WORKER_URL=https://bayaan-r2-migrator.<your-subdomain>.workers.dev")
        print("  AUTH_TOKEN=<the token you set via wrangler secret put>")
        sys.exit(1)

    env = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip()

    for key in ["WORKER_URL", "AUTH_TOKEN"]:
        if key not in env or not env[key]:
            print(f"Missing {key} in {ENV_FILE}")
            sys.exit(1)

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


def build_migration_plan(reciters, rewayat_slugs, style_slugs, source_filter=None, reciter_filter=None):
    """Same plan builder as migrate-to-r2.py — returns list of tasks."""
    tasks = []
    occupied = {}

    # First pass: Supabase (default priority)
    for reciter in reciters:
        name = reciter.get("name", "")
        reciter_slug = slugify(name)
        if reciter_filter and reciter_filter.lower() not in name.lower():
            continue

        for rw in reciter.get("rewpiayat", reciter.get("rewayat", [])):
            server = rw.get("server", "")
            if "supabase" not in server:
                continue
            if source_filter and source_filter != "supabase":
                continue

            rewayah_slug = rewayat_slugs.get(rw.get("name", ""))
            if not rewayah_slug:
                continue

            style_slug = style_slugs.get(rw.get("style", "murattal"), "murattal")
            key = (reciter_slug, rewayah_slug, style_slug)
            occupied.setdefault(key, []).append("default")

            surah_list = rw.get("surah_list", "")
            if isinstance(surah_list, str):
                surah_list = [s.strip() for s in surah_list.split(",") if s.strip()]

            tasks.append({
                "reciter_name": name,
                "reciter_slug": reciter_slug,
                "rewayah_slug": rewayah_slug,
                "style_slug": style_slug,
                "edition": "default",
                "source_type": "supabase",
                "server_url": server.rstrip("/"),
                "surah_list": surah_list,
                "r2_prefix": f"quran/recitations/{reciter_slug}/{rewayah_slug}/{style_slug}/default",
            })

    # Second pass: mp3quran
    for reciter in reciters:
        name = reciter.get("name", "")
        reciter_slug = slugify(name)
        if reciter_filter and reciter_filter.lower() not in name.lower():
            continue

        for rw in reciter.get("rewpiayat", reciter.get("rewayat", [])):
            server = rw.get("server", "")
            if "mp3quran" not in server:
                continue
            if source_filter and source_filter != "mp3quran":
                continue

            rewayah_slug = rewayat_slugs.get(rw.get("name", ""))
            if not rewayah_slug:
                print(f"  WARNING: No slug for '{rw.get('name', '')}' — skipping {name}")
                continue

            style_slug = style_slugs.get(rw.get("style", "murattal"), "murattal")
            key = (reciter_slug, rewayah_slug, style_slug)
            existing = occupied.get(key, [])

            edition = "default" if not existing else f"alt-{len(existing)}"
            occupied.setdefault(key, []).append(edition)

            surah_list = rw.get("surah_list", "")
            if isinstance(surah_list, str):
                surah_list = [s.strip() for s in surah_list.split(",") if s.strip()]

            tasks.append({
                "reciter_name": name,
                "reciter_slug": reciter_slug,
                "rewayah_slug": rewayah_slug,
                "style_slug": style_slug,
                "edition": edition,
                "source_type": "mp3quran",
                "server_url": server.rstrip("/"),
                "surah_list": surah_list,
                "r2_prefix": f"quran/recitations/{reciter_slug}/{rewayah_slug}/{style_slug}/{edition}",
            })

    return tasks


def worker_request(worker_url, auth_token, endpoint, payload):
    """Make a request to the Worker."""
    url = f"{worker_url.rstrip('/')}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}",
            "User-Agent": "Bayaan-R2-Migrator/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        return {"error": f"HTTP {e.code}: {body}"}
    except Exception as e:
        return {"error": str(e)}


def check_worker_health(worker_url, auth_token):
    """Verify the Worker is reachable."""
    url = f"{worker_url.rstrip('/')}/health"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {auth_token}",
            "User-Agent": "Bayaan-R2-Migrator/1.0",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data.get("status") == "ok"
    except Exception:
        return False


def send_batch(worker_url, auth_token, files, batch_num, total_batches):
    """Send a batch of files to the Worker with retries. Returns (succeeded, failed, failed_keys)."""
    remaining = files
    total_succeeded = 0
    all_failed_keys = []

    for attempt in range(1, MAX_RETRIES + 1):
        result = worker_request(worker_url, auth_token, "/migrate", {"files": remaining})

        if "error" in result:
            if attempt < MAX_RETRIES:
                print(f"    Batch {batch_num}/{total_batches}: ERROR (attempt {attempt}/{MAX_RETRIES}) — {result['error']}")
                time.sleep(2 ** attempt)  # exponential backoff
                continue
            else:
                print(f"    Batch {batch_num}/{total_batches}: FAILED after {MAX_RETRIES} attempts — {result['error']}")
                return total_succeeded, len(remaining), [f["r2_key"] for f in remaining]

        succeeded = result.get("succeeded", 0)
        failed = result.get("failed", 0)
        total_succeeded += succeeded

        if failed == 0:
            print(f"    Batch {batch_num}/{total_batches}: {total_succeeded} ok")
            return total_succeeded, 0, []

        # Collect failures and retry them
        failed_results = [r for r in result.get("results", []) if not r.get("success")]
        failed_keys = {r["r2_key"] for r in failed_results}

        if attempt < MAX_RETRIES:
            print(f"    Batch {batch_num}/{total_batches}: {succeeded} ok, {failed} failed (retrying, attempt {attempt}/{MAX_RETRIES})")
            remaining = [f for f in remaining if f["r2_key"] in failed_keys]
            time.sleep(2 ** attempt)
        else:
            print(f"    Batch {batch_num}/{total_batches}: {total_succeeded} ok, {failed} failed after {MAX_RETRIES} attempts")
            for r in failed_results:
                print(f"      FAILED: {r['r2_key']} — {r.get('error', '?')}")
            all_failed_keys = [r["r2_key"] for r in failed_results]

    return total_succeeded, len(all_failed_keys), all_failed_keys


def migrate_task_via_worker(task, worker_url, auth_token, batch_size, dry_run=False):
    """Migrate a single reciter entry via the Worker. Returns (success, failed, failed_keys)."""
    surah_list = task["surah_list"]

    if not surah_list:
        print(f"    No surahs listed, skipping.")
        return 0, 0, []

    if dry_run:
        print(f"    Would migrate {len(surah_list)} surahs to {task['r2_prefix']}/")
        return len(surah_list), 0, []

    # Build file list
    files = []
    for surah in surah_list:
        padded = str(surah).zfill(3)
        files.append({
            "source_url": f"{task['server_url']}/{padded}.mp3",
            "r2_key": f"{task['r2_prefix']}/{padded}.mp3",
        })

    # Split into batches
    batches = [files[i:i + batch_size] for i in range(0, len(files), batch_size)]
    total_batches = len(batches)

    total_success = 0
    total_failed = 0
    all_failed_keys = []

    # Send batches concurrently
    with ThreadPoolExecutor(max_workers=CONCURRENT_BATCHES) as pool:
        futures = {
            pool.submit(send_batch, worker_url, auth_token, batch, i + 1, total_batches): i
            for i, batch in enumerate(batches)
        }
        for future in as_completed(futures):
            succeeded, failed, failed_keys = future.result()
            total_success += succeeded
            total_failed += failed
            all_failed_keys.extend(failed_keys)

    return total_success, total_failed, all_failed_keys


def verify_migration(tasks, worker_url, auth_token):
    """Verify all expected files exist in R2."""
    print("Verifying migration...\n")

    total_expected = 0
    total_existing = 0
    total_missing = 0
    all_missing = []

    for i, task in enumerate(tasks):
        prefix = task["r2_prefix"]
        keys = [f"{prefix}/{str(s).zfill(3)}.mp3" for s in task["surah_list"]]
        total_expected += len(keys)

        # Batch verify (200 per request)
        for batch_start in range(0, len(keys), 200):
            batch = keys[batch_start:batch_start + 200]
            result = worker_request(worker_url, auth_token, "/verify", {"keys": batch})

            if "error" in result:
                print(f"  Verify error for {prefix}: {result['error']}")
                continue

            total_existing += result.get("existing", 0)
            missing = result.get("missing", [])
            total_missing += len(missing)
            all_missing.extend(missing)

        ed = f" ({task['edition']})" if task["edition"] != "default" else ""
        status = "ok" if total_missing == 0 else f"{len([m for m in all_missing if m['key'].startswith(prefix)])} missing"
        print(f"  [{i + 1}/{len(tasks)}] {task['reciter_name']:<30} {task['rewayah_slug']}/{task['style_slug']}{ed:<20} {status}")

    print(f"\n{'=' * 60}")
    print(f"Verification complete:")
    print(f"  Expected: {total_expected}")
    print(f"  Existing: {total_existing}")
    print(f"  Missing:  {total_missing}")

    if total_missing > 0:
        print(f"\nMissing files:")
        for m in all_missing[:50]:  # show first 50
            print(f"  {m['key']}")
        if len(all_missing) > 50:
            print(f"  ... and {len(all_missing) - 50} more")
        print(f"\nRe-run migration to fill gaps (Worker skips existing files).")
    else:
        print(f"\n  All files present!")

    return total_missing == 0


def main():
    parser = argparse.ArgumentParser(description="Migrate audio to R2 via Cloudflare Worker")
    parser.add_argument("--source", choices=["supabase", "mp3quran"])
    parser.add_argument("--reciter", type=str, help="Filter by reciter name")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--verify", action="store_true", help="Verify all files exist in R2")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    args = parser.parse_args()

    env = load_env()
    worker_url = env["WORKER_URL"]
    auth_token = env["AUTH_TOKEN"]

    rewayat_slugs, style_slugs = load_slug_mappings()
    with open(RECITERS_JSON) as f:
        reciters = json.load(f)

    print(f"Loaded {len(reciters)} reciters")
    print(f"Worker: {worker_url}")
    print(f"Batch size: {args.batch_size}, concurrent batches: {CONCURRENT_BATCHES}")
    print()

    # Health check
    if not args.dry_run:
        print("Checking Worker health... ", end="", flush=True)
        if check_worker_health(worker_url, auth_token):
            print("ok")
        else:
            print("FAILED")
            print("Make sure the Worker is deployed and AUTH_TOKEN is correct.")
            sys.exit(1)
        print()

    # Build plan
    tasks = build_migration_plan(reciters, rewayat_slugs, style_slugs, args.source, args.reciter)
    total_files = sum(len(t["surah_list"]) for t in tasks)

    supabase_count = sum(1 for t in tasks if t["source_type"] == "supabase")
    mp3quran_count = sum(1 for t in tasks if t["source_type"] == "mp3quran")

    print(f"Migration plan: {len(tasks)} entries, {total_files} files")
    print(f"  Supabase: {supabase_count}, mp3quran: {mp3quran_count}")
    print()

    if args.dry_run:
        for task in tasks:
            ed = f" ({task['edition']})" if task["edition"] != "default" else ""
            print(f"  {task['reciter_name']:<35} {task['rewayah_slug']}/{task['style_slug']}{ed}")
            print(f"    -> {task['r2_prefix']}/  ({len(task['surah_list'])} surahs)")
        print(f"\nTotal: {len(tasks)} entries, {total_files} files")
        return

    if args.verify:
        verify_migration(tasks, worker_url, auth_token)
        return

    # Load existing log (for resume tracking)
    log = {"completed_prefixes": [], "failed_keys": [], "runs": []}
    if LOG_FILE.exists():
        try:
            log = json.loads(LOG_FILE.read_text())
        except json.JSONDecodeError:
            pass

    completed_prefixes = set(log.get("completed_prefixes", []))

    # Run migration
    total_success = 0
    total_failed = 0
    total_skipped = 0
    all_failed_keys = []
    start_time = time.time()

    for i, task in enumerate(tasks):
        ed = f" ({task['edition']})" if task["edition"] != "default" else ""
        prefix = task["r2_prefix"]

        # Skip if fully completed in a previous run
        if prefix in completed_prefixes:
            total_skipped += len(task["surah_list"])
            print(f"[{i + 1}/{len(tasks)}] {task['reciter_name']} / {task['rewayah_slug']}/{task['style_slug']}{ed} — skipped (completed previously)")
            continue

        print(f"[{i + 1}/{len(tasks)}] {task['reciter_name']} / {task['rewayah_slug']}/{task['style_slug']}{ed}")
        print(f"  -> {prefix}/  ({len(task['surah_list'])} surahs)")

        success, failed, failed_keys = migrate_task_via_worker(task, worker_url, auth_token, args.batch_size)
        total_success += success
        total_failed += failed
        all_failed_keys.extend(failed_keys)

        if failed == 0:
            completed_prefixes.add(prefix)

        # Save progress after each task
        log["completed_prefixes"] = sorted(completed_prefixes)
        log["failed_keys"] = all_failed_keys
        LOG_FILE.write_text(json.dumps(log, indent=2))

        print()

    elapsed = time.time() - start_time
    rate = total_success / elapsed if elapsed > 0 else 0

    # Save final run summary
    log["runs"].append({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "source": args.source or "all",
        "succeeded": total_success,
        "failed": total_failed,
        "skipped": total_skipped,
        "elapsed_seconds": round(elapsed),
        "files_per_sec": round(rate, 1),
    })
    log["completed_prefixes"] = sorted(completed_prefixes)
    log["failed_keys"] = all_failed_keys
    LOG_FILE.write_text(json.dumps(log, indent=2))

    print("=" * 60)
    print(f"Migration complete in {elapsed:.0f}s ({rate:.1f} files/sec)")
    print(f"  Successful: {total_success}")
    print(f"  Failed: {total_failed}")
    print(f"  Skipped (previous runs): {total_skipped}")
    print(f"  Progress saved to: {LOG_FILE}")
    if total_failed > 0:
        print(f"\nRe-run to retry {total_failed} failed files (completed tasks will be skipped).")


if __name__ == "__main__":
    main()

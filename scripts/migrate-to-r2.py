#!/usr/bin/env python3
"""
Supabase & mp3quran → Cloudflare R2 Migration Script
=====================================================

Migrates all Quran recitation audio to R2 with the canonical directory structure:

  bayaan-audio/
  └── quran/recitations/{reciter}/{rewayah}/{style}/{edition}/{001-114}.mp3

Prerequisites:
  - AWS CLI installed (works with R2's S3-compatible API)
  - .env.r2 file with R2 + Supabase credentials
  - pip install python-dotenv (or just export the env vars)

Usage:
  python3 scripts/migrate-to-r2.py                    # Migrate all
  python3 scripts/migrate-to-r2.py --source supabase   # Supabase only
  python3 scripts/migrate-to-r2.py --source mp3quran   # mp3quran only
  python3 scripts/migrate-to-r2.py --dry-run            # Preview without uploading
  python3 scripts/migrate-to-r2.py --reciter "abdulbasit"  # Single reciter
"""

import json
import os
import subprocess
import sys
import argparse
import tempfile
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

# ── Paths ────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
RECITERS_JSON = PROJECT_DIR / "data" / "reciters.json"
SLUGS_JSON = PROJECT_DIR / "data" / "rewayat-slugs.json"
ENV_FILE = PROJECT_DIR / ".env.r2"

# ── R2 Config ────────────────────────────────────────────────────
R2_BUCKET = "bayaan-audio"


def load_env():
    """Load .env.r2 credentials."""
    if not ENV_FILE.exists():
        print(f"Missing {ENV_FILE}")
        print("Create it with: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    env = {}
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, val = line.split("=", 1)
            env[key.strip()] = val.strip()
            os.environ[key.strip()] = val.strip()

    required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
    for key in required:
        if key not in env or not env[key]:
            print(f"Missing {key} in .env.r2")
            sys.exit(1)

    os.environ["R2_ACCOUNT_ID"] = env["R2_ACCOUNT_ID"]
    os.environ["AWS_ACCESS_KEY_ID"] = env["R2_ACCESS_KEY_ID"]
    os.environ["AWS_SECRET_ACCESS_KEY"] = env["R2_SECRET_ACCESS_KEY"]
    os.environ["AWS_DEFAULT_REGION"] = "auto"

    return env


def load_slug_mappings():
    """Load canonical rewayah and style slug mappings."""
    with open(SLUGS_JSON) as f:
        data = json.load(f)
    return data["rewayat"], data["styles"]


def slugify(name: str) -> str:
    """Convert a reciter name to a URL-safe slug."""
    slug = name.lower().strip()
    # Transliterate common Arabic characters if any slip through
    slug = slug.replace("'", "").replace("'", "").replace("`", "")
    # Replace non-alphanumeric with hyphens
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    # Clean up
    slug = slug.strip("-")
    slug = re.sub(r"-+", "-", slug)
    return slug


def build_migration_plan(reciters, rewayat_slugs, style_slugs, source_filter=None, reciter_filter=None):
    """
    Build a list of migration tasks from reciters.json.

    Each task = {
        reciter_name, reciter_slug, rewayah_slug, style_slug, edition,
        source_type, server_url, surah_list, r2_prefix
    }
    """
    tasks = []

    # Track what Supabase reciters occupy so mp3quran duplicates get alt-N
    occupied = {}  # key: (reciter_slug, rewayah_slug, style_slug) -> list of editions

    # First pass: Supabase entries (they get "default" priority)
    for reciter in reciters:
        name = reciter.get("name", "")
        reciter_slug = slugify(name)

        if reciter_filter and reciter_filter.lower() not in name.lower():
            continue

        rewayat = reciter.get("rewpiayat", reciter.get("rewayat", []))
        for rw in rewayat:
            server = rw.get("server", "")
            if "supabase" not in server:
                continue
            if source_filter and source_filter != "supabase":
                continue

            rewayah_name = rw.get("name", "")
            rewayah_slug = rewayat_slugs.get(rewayah_name)
            if not rewayah_slug:
                print(f"  WARNING: No slug for rewayah '{rewayah_name}' — skipping {name}")
                continue

            raw_style = rw.get("style", "murattal")
            style_slug = style_slugs.get(raw_style, "murattal")
            edition = "default"

            key = (reciter_slug, rewayah_slug, style_slug)
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
                "source_type": "supabase",
                "server_url": server.rstrip("/"),
                "surah_list": surah_list,
                "r2_prefix": f"quran/recitations/{reciter_slug}/{rewayah_slug}/{style_slug}/{edition}",
            })

    # Second pass: mp3quran entries
    for reciter in reciters:
        name = reciter.get("name", "")
        reciter_slug = slugify(name)

        if reciter_filter and reciter_filter.lower() not in name.lower():
            continue

        rewayat = reciter.get("rewpiayat", reciter.get("rewayat", []))
        for rw in rewayat:
            server = rw.get("server", "")
            if "mp3quran" not in server:
                continue
            if source_filter and source_filter != "mp3quran":
                continue

            rewayah_name = rw.get("name", "")
            rewayah_slug = rewayat_slugs.get(rewayah_name)
            if not rewayah_slug:
                print(f"  WARNING: No slug for rewayah '{rewayah_name}' — skipping {name}")
                continue

            raw_style = rw.get("style", "murattal")
            style_slug = style_slugs.get(raw_style, "murattal")

            key = (reciter_slug, rewayah_slug, style_slug)
            existing = occupied.get(key, [])

            if not existing:
                edition = "default"
            else:
                alt_num = len(existing)
                edition = f"alt-{alt_num}"

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


def r2_endpoint():
    return f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"


def ensure_bucket():
    """Create R2 bucket if it doesn't exist."""
    result = subprocess.run(
        ["aws", "s3api", "head-bucket", "--bucket", R2_BUCKET, "--endpoint-url", r2_endpoint()],
        capture_output=True,
    )
    if result.returncode != 0:
        print(f"Creating R2 bucket '{R2_BUCKET}'...")
        subprocess.run(
            ["aws", "s3api", "create-bucket", "--bucket", R2_BUCKET, "--endpoint-url", r2_endpoint()],
            check=True,
        )
        print("  Bucket created.")
    else:
        print(f"Bucket '{R2_BUCKET}' already exists.")


def check_exists_in_r2(r2_key):
    """Check if a file already exists in R2."""
    result = subprocess.run(
        ["aws", "s3api", "head-object", "--bucket", R2_BUCKET, "--key", r2_key, "--endpoint-url", r2_endpoint()],
        capture_output=True,
    )
    return result.returncode == 0


def download_file(url, local_path):
    """Download a file from a URL."""
    result = subprocess.run(
        ["curl", "-sf", "-o", str(local_path), url],
        capture_output=True,
    )
    return result.returncode == 0


def upload_to_r2(local_path, r2_key):
    """Upload a file to R2."""
    result = subprocess.run(
        [
            "aws", "s3", "cp", str(local_path), f"s3://{R2_BUCKET}/{r2_key}",
            "--endpoint-url", r2_endpoint(),
            "--content-type", "audio/mpeg",
            "--cache-control", "public, max-age=31536000, immutable",
            "--quiet",
        ],
        capture_output=True,
    )
    return result.returncode == 0


def build_download_url(task, surah_num):
    """Build the download URL for a surah from its source."""
    padded = str(surah_num).zfill(3)

    if task["source_type"] == "supabase":
        return f"{task['server_url']}/{padded}.mp3"
    else:
        # mp3quran format
        return f"{task['server_url']}/{padded}.mp3"


PARALLEL_WORKERS = 10
print_lock = threading.Lock()


def migrate_single_file(task, tmp_dir, surah, index, total):
    """Download and upload a single surah file. Returns (surah, success)."""
    padded = str(surah).zfill(3)
    prefix = task["r2_prefix"]
    url = build_download_url(task, surah)
    local_path = Path(tmp_dir) / f"{padded}.mp3"
    r2_key = f"{prefix}/{padded}.mp3"

    ok = False
    if download_file(url, local_path):
        if upload_to_r2(local_path, r2_key):
            ok = True
        local_path.unlink(missing_ok=True)

    with print_lock:
        status = "ok" if ok else "FAILED"
        print(f"    [{index}/{total}] {padded}.mp3 ... {status}", flush=True)

    return ok


def migrate_task(task, tmp_dir, dry_run=False):
    """Migrate a single reciter/rewayah/style/edition to R2."""
    prefix = task["r2_prefix"]
    surah_list = task["surah_list"]

    if not surah_list:
        print(f"    No surahs listed, skipping.")
        return 0, 0

    # Spot-check: if first surah exists, skip this task
    first_surah = str(surah_list[0]).zfill(3)
    first_key = f"{prefix}/{first_surah}.mp3"
    if not dry_run and check_exists_in_r2(first_key):
        print(f"    Already migrated ({first_surah}.mp3 exists), skipping.")
        return len(surah_list), 0

    if dry_run:
        print(f"    Would migrate {len(surah_list)} surahs to {prefix}/")
        return len(surah_list), 0

    # Each file gets its own temp subdir to avoid filename collisions across threads
    task_dir = Path(tmp_dir) / task["reciter_slug"] / task["rewayah_slug"]
    task_dir.mkdir(parents=True, exist_ok=True)

    total = len(surah_list)
    success = 0
    failed = 0

    with ThreadPoolExecutor(max_workers=PARALLEL_WORKERS) as pool:
        futures = {
            pool.submit(migrate_single_file, task, str(task_dir), surah, i + 1, total): surah
            for i, surah in enumerate(surah_list)
        }
        for future in as_completed(futures):
            if future.result():
                success += 1
            else:
                failed += 1

    # Cleanup
    try:
        task_dir.rmdir()
    except OSError:
        pass

    return success, failed


def main():
    parser = argparse.ArgumentParser(description="Migrate Quran audio to Cloudflare R2")
    parser.add_argument("--source", choices=["supabase", "mp3quran"], help="Migrate only one source")
    parser.add_argument("--reciter", type=str, help="Filter by reciter name (partial match)")
    parser.add_argument("--dry-run", action="store_true", help="Preview migration plan without uploading")
    args = parser.parse_args()

    # Load everything
    env = load_env()
    rewayat_slugs, style_slugs = load_slug_mappings()

    with open(RECITERS_JSON) as f:
        reciters = json.load(f)

    print(f"Loaded {len(reciters)} reciters from {RECITERS_JSON.name}")
    print(f"Loaded {len(rewayat_slugs)} rewayah slugs, {len(style_slugs)} style slugs")
    print()

    # Build migration plan
    tasks = build_migration_plan(reciters, rewayat_slugs, style_slugs, args.source, args.reciter)

    supabase_tasks = [t for t in tasks if t["source_type"] == "supabase"]
    mp3quran_tasks = [t for t in tasks if t["source_type"] == "mp3quran"]
    total_files = sum(len(t["surah_list"]) for t in tasks)

    print(f"Migration plan:")
    print(f"  Supabase entries: {len(supabase_tasks)}")
    print(f"  mp3quran entries: {len(mp3quran_tasks)}")
    print(f"  Total files: {total_files}")
    print()

    if args.dry_run:
        print("DRY RUN — showing plan:\n")
        for task in tasks:
            edition_label = f" ({task['edition']})" if task["edition"] != "default" else ""
            print(f"  {task['reciter_name']:<35} {task['rewayah_slug']}/{task['style_slug']}{edition_label}")
            print(f"    -> {task['r2_prefix']}/")
            print(f"    <- {task['server_url']}")
            print(f"    {len(task['surah_list'])} surahs")
            print()
        print(f"Total: {len(tasks)} entries, {total_files} files")
        return

    # Create bucket
    ensure_bucket()
    print()

    # Run migration
    total_success = 0
    total_failed = 0

    with tempfile.TemporaryDirectory() as tmp_dir:
        for i, task in enumerate(tasks):
            edition_label = f" ({task['edition']})" if task["edition"] != "default" else ""
            header = f"[{i + 1}/{len(tasks)}] {task['reciter_name']} / {task['rewayah_slug']} / {task['style_slug']}{edition_label}"
            print(f"{'=' * 60}")
            print(f"  {header}")
            print(f"  -> {task['r2_prefix']}/")
            print(f"  <- {task['source_type']}: {task['server_url']}")

            success, failed = migrate_task(task, tmp_dir)
            total_success += success
            total_failed += failed
            print()

    # Summary
    print("=" * 60)
    print(f"Migration complete!")
    print(f"  Successful: {total_success}")
    print(f"  Failed: {total_failed}")
    print()
    print(f"Verify with:")
    print(f"  aws s3 ls s3://{R2_BUCKET}/quran/recitations/ --endpoint-url {r2_endpoint()}")
    print()
    if total_failed > 0:
        print(f"Re-run the script to retry failed files (it skips already-migrated entries).")


if __name__ == "__main__":
    main()

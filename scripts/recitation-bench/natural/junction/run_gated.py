"""Runs a manifest through bench.mjs in short batches, under the machine's limits.

    python3 -I natural/junction/run_gated.py <manifest.json> <outdir> <procs> [--batch 30]

Before each batch it needs free disk over 10 GB, swap under 20 GB used, and a free
slot among this job's 3 bench processes at once, paused ones included. It waits
until that holds and starts only as many as fit. It kills nothing: a paused process
is waited for. Finished clips are skipped, so it resumes, and clips a process from an
earlier start still holds are left to it. A result that does not parse is moved aside
and run again. One runner per output folder: a second one says so and exits. The env
carries BENCH_PROBE, JUNCTION_POST_DIR, TILAWA_DIST and ENGINE_OPTS. Run from
scripts/recitation-bench.
"""
import argparse
import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
import time

LIMIT = 3
MIN_FREE_GB = 10
MAX_SWAP_MB = 20000
BENCH = os.path.abspath('bench.mjs')
JOB = '.out/natural/junction'
LOCK = os.path.join(JOB, '.start_lock')
MINE = re.compile(r'^\s*\S+\s+node\s.*bench\.mjs --list \.out/natural/junction/')


def say(*a):
    print(time.strftime('%T'), *a, flush=True)


def machine():
    out = subprocess.run(['df', '-g', '/System/Volumes/Data'], capture_output=True, text=True).stdout
    free = int(out.splitlines()[1].split()[3])
    out = subprocess.run(['sysctl', '-n', 'vm.swapusage'], capture_output=True, text=True).stdout
    swap = float(re.search(r'used = ([\d.]+)M', out).group(1))
    out = subprocess.run(['ps', '-axo', 'stat=,args='], capture_output=True, text=True).stdout
    running = sum(1 for line in out.splitlines() if MINE.match(line) and not line.strip().startswith('Z'))
    return free, swap, running


def take_lock():
    """One starter at a time, so two runs cannot both see the same free slot."""
    try:
        os.mkdir(LOCK)
        return True
    except FileExistsError:
        try:
            if time.time() - os.path.getmtime(LOCK) > 180:
                os.rmdir(LOCK)
        except OSError:
            pass
        return False


def name_of(clip):
    return re.sub(r'[^\w.-]', '_', str(clip['id'])) + '.json'


def held_by_live(shards):
    """Clips listed for a live process of this output folder, from an earlier start."""
    out = subprocess.run(['ps', '-axo', 'stat=,args='], capture_output=True, text=True).stdout
    root = os.path.abspath(shards) + os.sep
    held = set()
    for line in out.splitlines():
        m = re.search(r'--list (\S+)', line) if MINE.match(line) else None
        if not m or not os.path.abspath(m.group(1)).startswith(root):
            continue
        try:
            with open(m.group(1), encoding='utf-8') as f:
                held.update(name_of(c) for c in json.load(f))
        except (OSError, ValueError):
            pass
    return held


def suite_on(outdir):
    """A run_suite.mjs still working on this output folder."""
    out = subprocess.run(['ps', '-axo', 'args='], capture_output=True, text=True).stdout
    return any(
        line.startswith('node ') and 'run_suite.mjs' in line and f' {outdir.rstrip("/")} ' in line + ' '
        for line in out.splitlines()
    )


def set_aside_bad(clips, outdir):
    aside = os.path.join(os.path.dirname(outdir.rstrip('/')), f'bad_{os.path.basename(outdir.rstrip("/"))}')
    moved = 0
    for clip in clips:
        file = os.path.join(outdir, name_of(clip))
        if not os.path.exists(file) or time.time() - os.path.getmtime(file) < 120:
            continue
        try:
            with open(file, encoding='utf-8') as f:
                json.load(f)
        except (ValueError, OSError):
            os.makedirs(aside, exist_ok=True)
            shutil.move(file, os.path.join(aside, name_of(clip)))
            moved += 1
    if moved:
        say(f'moved {moved} results that do not parse to {aside}; they run again')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('manifest')
    ap.add_argument('outdir')
    ap.add_argument('procs', type=int)
    ap.add_argument('--batch', type=int, default=30, help='clips per process per batch')
    args = ap.parse_args()
    with open(args.manifest, encoding='utf-8') as f:
        clips = json.load(f)
    os.makedirs(args.outdir, exist_ok=True)
    label = os.path.basename(args.outdir.rstrip('/'))
    guard = open(os.path.join(os.path.dirname(args.outdir.rstrip('/')), f'.run_{label}.lock'), 'w')
    try:
        fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        say(f'{label}: another runner already has this output folder; not starting a second')
        return
    while suite_on(args.outdir):
        time.sleep(20)
    set_aside_bad(clips, args.outdir)
    shards = os.path.join(os.path.dirname(args.outdir.rstrip('/')), f'.shards_{label}')
    os.makedirs(shards, exist_ok=True)
    stuck = 0
    batch = 0
    while True:
        done = set(os.listdir(args.outdir))
        left = [c for c in clips if name_of(c) not in done]
        if not left:
            break
        held = held_by_live(shards)
        todo = [c for c in left if name_of(c) not in held]
        if not todo:
            time.sleep(20)
            continue
        waited = None
        while True:
            have_lock = take_lock()
            free, swap, running = machine()
            slots = min(args.procs, LIMIT - running)
            if have_lock and free > MIN_FREE_GB and swap < MAX_SWAP_MB and slots >= 1:
                break
            if have_lock:
                os.rmdir(LOCK)
            why = f'free {free} GB, swap {swap:.0f} MB, running {running}'
            if why.split(',')[2] != (waited or ',,').split(',')[2] or waited is None:
                say(f'{label}: waiting: {why}')
            waited = why
            time.sleep(20)
        batch += 1
        say(f'{label}: batch {batch}: {len(todo)} to run, free {free} GB, swap {swap:.0f} MB, '
            f'running {running}, starting {slots}')
        procs = []
        env = {**os.environ, 'ORT_THREADS': '1'}
        for i in range(slots):
            part = todo[i * args.batch:(i + 1) * args.batch]
            if not part:
                continue
            file = os.path.join(shards, f'{os.getpid()}_{i}.json')
            with open(file, 'w', encoding='utf-8') as f:
                json.dump(part, f)
            procs.append(subprocess.Popen(['node', BENCH, '--list', file, '--outdir', args.outdir], env=env))
        # Hold the lock until the new processes can be counted.
        for _ in range(20):
            if machine()[2] >= running + len(procs):
                break
            time.sleep(0.5)
        os.rmdir(LOCK)
        codes = [p.wait() for p in procs]
        if any(codes):
            say(f'{label}: batch {batch} exit codes {codes}')
        now = len([c for c in clips if name_of(c) not in set(os.listdir(args.outdir))])
        stuck = stuck + 1 if now == len(left) else 0
        if stuck >= 3:
            say(f'{label}: three batches with no new result, stopping with {now} to run')
            sys.exit(1)
    shutil.rmtree(shards, ignore_errors=True)
    say(f'{label}: finished; all {len(clips)} clips have a result')


if __name__ == '__main__':
    main()

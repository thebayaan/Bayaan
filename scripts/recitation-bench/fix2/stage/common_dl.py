"""Shared download/convert helpers. Polite: callers cap threads per host; ffmpeg capped at 2."""
import os, subprocess, threading, time
FF = threading.Semaphore(2)
def fetch(url, dest):
    """Resumable curl. Returns 'ok', 'missing' (404) or 'error:<code>'."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    for attempt in range(4):
        r = subprocess.run(['curl', '-sSL', '--fail', '--retry', '4', '--retry-delay', '3', '-C', '-',
                            '-o', dest, '-w', '%{http_code}', url], capture_output=True, text=True)
        code = r.stdout.strip()[-3:]
        if r.returncode == 0:
            return 'ok'
        if code in ('404', '403', '410'):
            if os.path.exists(dest): os.remove(dest)
            return 'missing'
        if code == '416' and os.path.exists(dest) and os.path.getsize(dest) > 0:
            return 'ok'  # already complete
        time.sleep(5 * (attempt + 1))
    return 'error:' + (code or str(r.returncode))
def to_f32(src, out):
    tmp = out + '.part'
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with FF:
        r = subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-ar', '16000',
                            '-f', 'f32le', tmp], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(tmp) or os.path.getsize(tmp) == 0:
        if os.path.exists(tmp): os.remove(tmp)
        return 'ffmpeg:' + r.stderr.strip()[:200]
    os.replace(tmp, out)
    return 'ok'
def seconds(path):
    return round(os.path.getsize(path) / 64000, 4)

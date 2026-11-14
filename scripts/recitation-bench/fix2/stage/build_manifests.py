"""python3 -I fix2/stage/build_manifests.py [set ...]   Builds <set>/manifest.json for twin_ayat, ikhlas, sobolev, qdat_bench
from staged audio + metadata. Seconds from file size (16 kHz f32 = 64,000 B/s). No text is written."""
import json, os, sys, glob, re, hashlib, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qtext
from paths import DATA as D
W = qtext.words()
def sec(p): return round(os.path.getsize(p) / 64000, 4)
def clip(**k):
    base = dict(id=None, audio=None, seconds=None, reciter=None, group=None, kind=None, surah=None, ayahStart=None,
                ayahEnd=None, leadSeconds=None, timings=None, timingsKind=None, label=None, extra={})
    base.update(k); return base
def write(name, made, sources, clips):
    m = {'set': name, 'made': made, 'sources': sources, 'clips': clips}
    json.dump(m, open(f'{D}/{name}/manifest.json', 'w'), indent=1, ensure_ascii=True)
    h = sum(c['seconds'] for c in clips) / 3600
    w = sum(qtext.nwords(c['surah'], c['ayahStart'], c['ayahEnd']) for c in clips)
    print(name, len(clips), 'clips', round(h, 3), 'h', w, 'words (whole ayat by data/quran.json)')

def twin():
    from stage_twin import EA, ZH
    ayat = json.load(open(f'{D}/twin_ayat/ayat.json'))
    status = json.load(open(f'{D}/twin_ayat/status.json'))
    roles = collections.defaultdict(set)
    for p in json.load(open(f'{D}/twin_ayat/pairs.json')):
        roles[p['x']].add(p['type'] + ':x'); roles[p['y']].add(p['type'] + ':y')
    voices = [(f, g, 'everyayah') for g, fs in EA.items() for f in fs] + [(z, 'heldout', 'zh') for z in ZH]
    clips, tj = [], {}
    for v, g, src in voices:
        for k in ayat:
            s, a = map(int, k.split(':'))
            p = f'{D}/twin_ayat/audio/{v}/{s:03d}{a:03d}.f32'
            if not os.path.exists(p): continue
            ex = {'source': src, 'pairRoles': sorted(roles[k])}
            if a == 1 and s not in (1, 9): ex['mayStartWithBasmala'] = True
            t = tk = None
            if src == 'zh':
                t = f'{D}/twin_ayat/timings/{v}/{s:03d}.json'
                if os.path.exists(t):
                    if t not in tj: tj[t] = {x['key']: x for x in json.load(open(t))['verses']}
                    ver = tj[t].get(k)
                    if ver:
                        tk = 'zh-words-verse'
                        ends = [w['endTime'] for w in ver['words']]
                        ex['zhTimings'] = {'words': len(ver['words']), 'officialWords': len(W[k]),
                                           'countMatches': len(ver['words']) == len(W[k]),
                                           'monotone': all(x <= y for x, y in zip(ends, ends[1:])),
                                           'jsonDurationMs': ver.get('duration_ms'), 'lastWordEndMs': max(ends) if ends else None}
                        if len(ver['words']) != len(W[k]):
                            ex['warning'] = 'ZH word list differs in length from the official ayah: the recording may hold repeats or a neighbouring ayah; check before use'
                    else: t = None
                else: t = None
            clips.append(clip(id=f'twin__{v}__{s:03d}{a:03d}', audio=p, seconds=sec(p), reciter=f'{src}:{v}', group=g,
                              kind='ayah', surah=s, ayahStart=a, ayahEnd=a, timings=t, timingsKind=tk, extra=ex))
    miss = {v: sorted(k for k, r in x.items() if r != 'ok') for v, x in status.items()}
    json.dump(miss, open(f'{D}/twin_ayat/missing.json', 'w'), indent=0)
    write('twin_ayat',
          'Whole-ayah recordings of every distinct ayah on either side of the W1 one-word-different pairs '
          '(sub, spelling-only and indel incl. short indels; maps/w1_pairs.json, reduced to numbers in pairs.json). '
          'One recording per voice: 6 checker-and-follower-trained EveryAyah folders (dev), 4 checker-held-out EveryAyah '
          'folders (checker_heldout), 4 zaibihassan CDN per-verse opus voices (heldout). Downloaded with curl, '
          'decoded with ffmpeg to 16 kHz mono f32le, compressed files deleted. Play a recording of y against the official '
          'text of its twin x (data/quran.json). Missing source files are listed in missing.json.',
          [{'name': 'EveryAyah', 'url': 'https://everyayah.com/data/<folder>/<SSS><AAA>.mp3', 'licence': 'none stated (HF mirror: recordings undocumented); local test use only',
            'note': 'dev folders: trained by checker (base.yaml hafs_reciters) and follower (EveryAyah fine-tune). Sahl_Yassin, Akram_AlAlaqimy, Hani_Rifai, Ibrahim_Akhdar: checker test reciters (voice-unseen by checker; Hani_Rifai_192kbps and Ibrahim_Akhdar_32kbps are other bitrates of the listed test folders), follower-seen.'},
           {'name': 'zaibihassan/Quranic-Recitation-Data (CDN cdn.mualim.app)', 'url': 'https://cdn.mualim.app/<slug>/<SSS>/<SSS><AAA>.opus', 'licence': 'Apache-2.0 (declared by uploader; audio origin undocumented)',
            'note': 'not in checker training; not in follower 0.4.0 NOTICE; voices not EveryAyah/Muaalem/QUA by name; Quran-Lab base archive tier cannot be checked. Al-Nufais was held out of the Quran-Lab benchmark.'}],
          clips)

def ikhlas():
    meta = json.load(open(f'{D}/_dl/ikhlas/meta.json'))
    clips = []
    for p in sorted(glob.glob(f'{D}/ikhlas/audio/*.f32'), key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', p)]):
        stem = os.path.basename(p)[:-4]
        m = re.fullmatch(r'ID(\d+)V([1-4])([TF])', stem)
        who = f'ID{m.group(1)}'; v = int(m.group(2))
        half = 'test' if int(hashlib.sha256(('ikhlas' + who).encode('utf-8')).hexdigest()[:8], 16) % 2 else 'dev'
        x = meta.get(stem)
        ex = {'speaker': who, 'half': half, 'file': stem + '.wav'}
        if x:
            ex.update({'xlsxRow': x['xlsxRow'], 'xlsxFlag': x['trueFalse'], 'errorClasses': x['errorClasses'],
                       'errorWords': x['errorWords'], 'errorLocationUnmappedTokens': x['errorLocationUnmappedTokens'],
                       'errorNumber': x['errorNumber']})
        else: ex['xlsxRow'] = None
        clips.append(clip(id=f'ikhlas__{stem}', audio=p, seconds=sec(p), reciter=f'ikhlas:{who}', group='ordinary', kind='ayah',
                          surah=112, ayahStart=v, ayahEnd=v, label='correct' if m.group(3) == 'T' else 'incorrect', extra=ex))
    write('ikhlas',
          'Al-Ikhlas error-detection dataset (Mendeley DOI 10.17632/sxtmmr6mvk.1): one zip (sha256 verified), wav names '
          'ID<speaker>V<verse><T|F> read from the archive listing, each wav converted with ffmpeg to 16 kHz mono f32le; zip and wavs '
          'deleted. label from the file name (T correct, F incorrect). Dataset.xlsx was read as XML data: error classes '
          '(tajweed / harakat) and the error location mapped to 1-based word numbers of 112:<verse> by letter skeleton; '
          'no text kept. extra.half = dev|test by the old bench rule sha256("ikhlas"+speaker)[:8] odd -> test.',
          [{'name': 'Al-Ikhlas Quran recitation error detection (Mendeley Data)', 'url': 'https://data.mendeley.com/public-files/datasets/sxtmmr6mvk/files/ec1b3a42-700d-4424-b6cd-6844828f4637/file_downloaded',
            'licence': 'CC BY 4.0', 'note': 'not in checker or follower 0.4.0 training (neither lists it)'}], clips)

def sobolev():
    meta = json.load(open(f'{D}/_dl/sobolev/meta.json'))
    clips = []
    for m in sorted(meta, key=lambda m: (m['recording'], m['chunk'])):
        p = f"{D}/sobolev/audio/{m['recording']}-{m['chunk']}.f32"
        if not os.path.exists(p): continue
        cls = {c for e in m['errors'] for c in e['classes']}
        label = 'incorrect' if 'Wording' in cls else ('correct' if not m['errors'] else None)
        ex = {'recording': m['recording'], 'chunk': m['chunk'], 'mushafPublisher': m['mushaf_publisher'], 'reviewer': m['reviewer'],
              'errors': [{'word': e['word'], 'classes': e['classes'], 'wordMethod': e.get('method')} for e in m['errors']],
              'labelNote': {'correct': '"correct" means no error recorded by the reviewer (weak; not verified correct)',
                            'incorrect': 'has a Wording error', None: 'only Letters/Tajweed/Tashkeel errors recorded: no label'}[label],
              'mayRunPastAyah': 'chunks can be longer than the labelled ayah (make_takes.py: extendsTo)'}
        clips.append(clip(id=f"sobolev__{m['recording']}-{m['chunk']}", audio=p, seconds=sec(p), reciter=f"sobolev:{m['recording']}",
                          group='ordinary', kind='ayah', surah=m['surah'], ayahStart=m['ayah'], ayahEnd=m['ayah'], label=label, extra=ex))
    write('sobolev',
          'Hafs rows (riwayah == "Hafs") of sobolev210/quran-recitation-errors metadata.jsonl; each listed wav downloaded '
          '(4 at a time), converted to 16 kHz mono f32le, deleted. The metadata gives one surah and ayah per chunk, so kind is '
          '"ayah". Error words (keyed by word text in the source) were mapped to 1-based word numbers of the official ayah '
          'by letter skeleton, else by position in the row\'s own text when its word count equals the official one, else '
          'edit distance 1; extra.errors[].wordMethod says which. id = <recording>-<chunk> as the old bench used.',
          [{'name': 'sobolev210/quran-recitation-errors', 'url': 'https://huggingface.co/datasets/sobolev210/quran-recitation-errors',
            'licence': 'MIT', 'note': 'not in checker or follower 0.4.0 training'}], clips)

def qdat():
    meta = json.load(open(f'{D}/_dl/qdat/meta.json'))['rows']
    clips = []
    for r in meta:
        p = f"{D}/qdat_bench/audio/{r['id']}.f32"
        ex = {k: v for k, v in r.items() if k not in ('id', 'sourceExt')}
        ex.update({'wordStart': 8, 'wordEnd': 15, 'wordSpanNote': '1-based words of 5:109 in data/quran.json; the card\'s span (8 words) matched words 8-15 by letter skeleton, i.e. to the end of the ayah',
                   'tajweedColumnsNote': 'integer tajweed attributes as in the dataset card (madd lengths 0-8, ghunnah, qalqalah)'})
        clips.append(clip(id=f"qdat__{r['id']}", audio=p, seconds=sec(p), reciter=f"qdat:{r['original_id'] or r['id']}", group='ordinary',
                          kind='span', surah=5, ayahStart=109, ayahEnd=109, label='correct', extra=ex))
    write('qdat_bench',
          'obadx/qdat_bench train parquet (sha256 = LFS oid verified), read with pyarrow in a local venv (python -I); each audio '
          'blob written to an empty dir, converted with ffmpeg to 16 kHz mono f32le, deleted; parquet deleted. Metadata columns '
          'kept except the phonetic transcript and sifat. All clips read the same words: 5:109 words 8-15.',
          [{'name': 'obadx/qdat_bench', 'url': 'https://huggingface.co/datasets/obadx/qdat_bench', 'licence': 'Apache-2.0',
            'note': 'not in checker or follower 0.4.0 training (Tilawa 1.0 used qdat)'}], clips)

if __name__ == '__main__':
    want = sys.argv[1:] or ['twin_ayat', 'ikhlas', 'sobolev', 'qdat_bench']
    for w in want: {'twin_ayat': twin, 'ikhlas': ikhlas, 'sobolev': sobolev, 'qdat_bench': qdat}[w]()

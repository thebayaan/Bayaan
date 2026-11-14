"""Every manifest under .out/fix2/data against the clip contract: fields, ids, audio files and
their lengths, legal values. python3 -I fix2/stage/verify_schema.py <out.json>"""
import json,glob,os,sys,collections,statistics
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA  # noqa: E402
REQ=["id","audio","seconds","reciter","group","kind","surah","ayahStart","ayahEnd","leadSeconds","timings","timingsKind","label","extra"]
TOP=["set","made","sources","clips"]
GROUPS={"dev","heldout","checker_heldout","ordinary"};KINDS={"surah","ayah","span"}
TK={"qdc-words","mp3quran-ayat","zh-words-surah","zh-words-verse",None}
out={}
for mf in sorted(glob.glob(os.path.join(DATA, "*", "manifest.json"))):
  m=json.load(open(mf)); name=m.get("set"); probs=[]
  for k in TOP:
    if k not in m: probs.append(f"top missing {k}")
  for s in m.get("sources",[]):
    for k in ["name","url","licence","note"]:
      if k not in s: probs.append(f"source {s.get('name')} missing {k}")
  ids=collections.Counter(); per=collections.defaultdict(lambda:[0,0.0,0]); 
  for c in m["clips"]:
    ids[c.get("id")]+=1
    miss=[k for k in REQ if k not in c]
    if miss: probs.append(f"{c.get('id')} missing {miss}")
    if c.get("group") not in GROUPS: probs.append(f"{c['id']} group {c.get('group')}")
    if c.get("kind") not in KINDS: probs.append(f"{c['id']} kind {c.get('kind')}")
    if c.get("timingsKind") not in TK: probs.append(f"{c['id']} timingsKind {c.get('timingsKind')}")
    if c.get("label") not in ("correct","incorrect",None): probs.append(f"{c['id']} label {c.get('label')}")
    if c.get("timings") and not os.path.exists(c["timings"]): probs.append(f"{c['id']} timings missing file")
    if (c.get("timings") is None)!=(c.get("timingsKind") is None): probs.append(f"{c['id']} timings/timingsKind mismatch")
    a=c.get("audio","")
    if not os.path.isabs(a) or not os.path.exists(a): probs.append(f"{c['id']} audio missing {a}"); continue
    b=os.path.getsize(a); sec=b/4/16000
    if b%4: probs.append(f"{c['id']} size not multiple of 4")
    if abs(sec-c["seconds"])>0.05: probs.append(f"{c['id']} seconds {c['seconds']} vs file {sec:.3f}")
    if sec<0.5: probs.append(f"{c['id']} short {sec:.2f}s")
    if c["kind"]!="span" and not (isinstance(c.get("surah"),int) and isinstance(c.get("ayahStart"),int) and isinstance(c.get("ayahEnd"),int) and c["ayahStart"]<=c["ayahEnd"]): probs.append(f"{c['id']} bad surah/ayah")
    g=per[c["group"]]; g[0]+=1; g[1]+=sec; g[2]+=b
  dup=[i for i,n in ids.items() if n>1]
  if dup: probs.append(f"duplicate ids {dup[:5]} ({len(dup)})")
  auds=collections.Counter(c["audio"] for c in m["clips"]); da=[a for a,n in auds.items() if n>1]
  if da: probs.append(f"audio shared by >1 clip: {len(da)}")
  tot=[sum(v[0] for v in per.values()), round(sum(v[1] for v in per.values())/3600,3), round(sum(v[2] for v in per.values())/1e9,3)]
  out[name]={"file":mf,"total":tot,"groups":{k:[v[0],round(v[1]/3600,3),round(v[2]/1e9,3)] for k,v in per.items()},"kinds":dict(collections.Counter(c["kind"] for c in m["clips"])),"problems":probs[:40],"nprob":len(probs)}
json.dump(out,open(sys.argv[1],"w"),indent=1)
for k,v in out.items(): print(k,v["total"],v["groups"],v["kinds"],v["nprob"],v["problems"][:8])

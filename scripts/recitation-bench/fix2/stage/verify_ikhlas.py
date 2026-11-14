"""The Al-Ikhlas halves: speakers, clips, labels and lengths per half, and whether the half rule
reproduces. python3 -I fix2/stage/verify_ikhlas.py   (writes .out/fix2/data/logs/verify_ikhlas.json)"""
import json,collections,hashlib,statistics,sys,os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paths import DATA as D  # noqa: E402
os.makedirs(f'{D}/logs', exist_ok=True)
m=json.load(open(f'{D}/ikhlas/manifest.json'))['clips']
out={}
for h in ['dev','test']:
  cs=[c for c in m if c['extra']['half']==h]
  sec=sorted(c['seconds'] for c in cs)
  q=lambda p: round(sec[min(len(sec)-1,int(p*len(sec)))],2)
  out[h]={'speakers':len({c['extra']['speaker'] for c in cs}),'clips':len(cs),'T':sum(c['label']=='correct' for c in cs),'F':sum(c['label']=='incorrect' for c in cs),
   'sec_min':q(0),'p10':q(.1),'median':q(.5),'p90':q(.9),'sec_max':sec[-1],
   'byAyah':dict(sorted(collections.Counter(c['ayahStart'] for c in cs).items()))}
# speakers split cleanly? rule recheck
spk=collections.defaultdict(set)
for c in m: spk[c['extra']['speaker']].add(c['extra']['half'])
out['speakersInBothHalves']=[s for s,v in spk.items() if len(v)>1]
rule=sum(1 for s,v in spk.items() if (('test' if int(hashlib.sha256(('ikhlas'+s).encode()).hexdigest()[:8],16)%2 else 'dev') not in v))
out['ruleMismatches']=rule
out['reciterKeyMatchesSpeaker']=all(c['reciter']=='ikhlas:'+c['extra']['speaker'] for c in m)
out['ayahWithinSurah']=all(c['surah']==112 and 1<=c['ayahStart']==c['ayahEnd']<=4 for c in m)
out['labelVsFilename']=sum(1 for c in m if c['extra']['file'][-5] != {'correct':'T','incorrect':'F'}[c['label']])
print(json.dumps(out,indent=1)); json.dump(out,open(f'{D}/logs/verify_ikhlas.json','w'),indent=1)

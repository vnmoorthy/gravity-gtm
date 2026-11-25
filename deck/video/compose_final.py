import json, subprocess, glob, os, sys
B=os.path.dirname(os.path.abspath(__file__))+"/build"; os.chdir(B)
W,H,FPS=1920,1080,30
C=json.load(open("cuts.json")); M={m["id"]:m["t"] for m in json.load(open("markers.json"))}
N={x["id"]:x for x in json.load(open("narration.json"))}
raw=sorted(glob.glob("raw/*.webm"),key=os.path.getmtime)[-1]
def sh(c):
    r=subprocess.run(c,capture_output=True,text=True)
    if r.returncode: print(r.stderr[-1500:]); sys.exit(1)
order=["intake","warroom","icp","accounts","ask","graph","hitl","approve","pipeline","analytics","billing","data"]
srcb={s:M[s] for s in order}; srcb["_end"]=M["end"]
nxt=lambda i: order[i+1] if i+1<len(order) else "_end"
outnext=lambda i: order[i+1] if i+1<len(order) else "outro"
# 1) body segments
parts=[];fl=[];badges=[]
k=0
for i,s in enumerate(order):
    a,b=srcb[s],srcb[nxt(i)]; L_out=C[outnext(i)]-C[s]
    if s=="warroom":
        ffs,ffe=M["ff_start"],M["ff_end"]; p1=min(ffs-a, L_out*0.62); rest=L_out-p1
        fl.append(f"[0:v]trim={a}:{a+p1},setpts=PTS-STARTPTS[s{k}]"); parts.append(f"[s{k}]"); k+=1
        f2=(b-(a+p1))/rest
        fl.append(f"[0:v]trim={a+p1}:{b},setpts=(PTS-STARTPTS)/{f2:.4f}[s{k}]"); parts.append(f"[s{k}]"); k+=1
        badges.append((C[s]+p1, C[outnext(i)], f2)); continue
    L=b-a; f=L/L_out
    if f>=0.7: fl.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/{f:.4f}[s{k}]")
    else: fl.append(f"[0:v]trim={a}:{b},setpts=(PTS-STARTPTS)/0.7,tpad=stop_mode=clone:stop_duration={L_out-L/0.7:.3f}[s{k}]")
    if f>2.5: badges.append((C[s],C[outnext(i)],f))
    parts.append(f"[s{k}]"); k+=1
fl.append("".join(parts)+f"concat=n={len(parts)}:v=1:a=0,scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p[v]")
if not os.path.exists("body.mp4"): sh(["ffmpeg","-y","-loglevel","error","-i",raw,"-filter_complex",";".join(fl),"-map","[v]","-c:v","libx264","-preset","veryfast","-crf","19","body.mp4"])
# 2) intro: face full (0..8.0) then hero card (8.0..intake)
I=C["intake"]; split=8.0
if not os.path.exists("intro.mp4"): sh(["ffmpeg","-y","-loglevel","error","-ss","0","-t",f"{split}","-i","../Voiceover.mov","-loop","1","-t",f"{I-split}","-i","gfx/intro.png",
 "-filter_complex",f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS},format=yuv420p,setsar=1[a];[1:v]scale={W}:{H},fps={FPS},format=yuv420p,setsar=1,zoompan=z='min(zoom+0.0007,1.05)':d={int((I-split)*FPS)}:s={W}x{H}:fps={FPS}[b];[a][b]concat=n=2:v=1:a=0[v]",
 "-map","[v]","-c:v","libx264","-preset","veryfast","-crf","19","intro.mp4"])
O=C["end"]-C["outro"]
sh(["ffmpeg","-y","-loglevel","error","-loop","1","-t",f"{O+2.0}","-i","gfx/outro.png","-vf",f"scale={W}:{H},fps={FPS},format=yuv420p,setsar=1","-c:v","libx264","-preset","veryfast","-crf","19","outro.mp4"])
open("list.txt","w").write("file 'intro.mp4'\nfile 'body.mp4'\nfile 'outro.mp4'\n")
norm=f"fps={FPS},scale={W}:{H},format=yuv420p,setsar=1,settb=AVTB,setpts=PTS-STARTPTS"
sh(["ffmpeg","-y","-loglevel","error","-i","intro.mp4","-i","body.mp4","-i","outro.mp4","-filter_complex",f"[0:v]{norm}[a];[1:v]{norm}[b];[2:v]{norm}[c];[a][b][c]concat=n=3:v=1:a=0[v]","-map","[v]","-c:v","libx264","-preset","veryfast","-crf","19","base.mp4"])
T=C["end"]+2.0
# 3) overlays: face bubble (body+outro), captions, badges, progress bar, hook text
inp=["-i","base.mp4","-i","../Voiceover.mov"]
inp+=["-i","gfx/mask300.png","-i","gfx/mask420.png","-i","gfx/ring312.png","-i","gfx/ring432.png"]
f=["[1:v]crop=720:720:280:0,scale=300:300,format=yuva420p[fc]","[2:v]format=gray,scale=300:300[m1]","[fc][m1]alphamerge[face]",
   "[1:v]crop=720:720:280:0,scale=420:420,format=yuva420p[fl]","[3:v]format=gray,scale=420:420[m2]","[fl][m2]alphamerge[faceL]",
   "[4:v]format=rgba[ring]","[5:v]format=rgba[ringL]"]
last="[0:v]"; n=2
def ov(src,x,y,en):
    global last,n
    f.append(f"{last}{src}overlay={x}:{y}:enable='{en}'[o{n}]"); last=f"[o{n}]"; n+=1
bstart,ostart=C["intake"],C["outro"]
ov("[ring]",W-312-44,H-312-40,f"between(t,{bstart},{ostart})")
ov("[face]",W-300-50,H-300-46,f"between(t,{bstart},{ostart})")
ov("[ringL]",W-432-150,(H-432)//2+40,f"gte(t,{ostart})")
ov("[faceL]",W-420-156,(H-420)//2+46,f"gte(t,{ostart})")
ci=6
for i,s in enumerate(order):
    inp+=["-loop","1","-t",f"{T}","-i",f"gfx/cap_{s}.png"]; st=C[s]+0.15; en=min(C[outnext(i)]-0.15, st+7)
    ov(f"[{ci}:v]",0,0,f"between(t,{st:.2f},{en:.2f})"); ci+=1
for (a,b,fct) in badges:
    inp+=["-loop","1","-t",f"{T}","-i","gfx/ff.png"]; ov(f"[{ci}:v]",0,0,f"between(t,{a:.2f},{b:.2f})"); ci+=1
inp+=["-f","lavfi","-i",f"color=c=0x2f5bea:s={W}x8:d={T}"]
f.append(f"{last}[{ci}:v]overlay=x='-{W}+{W}*t/{T:.2f}':y={H-8}[vout]")
inp+=["-i","../Voiceover.mov"]; ai=ci+1
cutsT=[C[s] for s in order]+[C["outro"]]
wh="".join(f"[w{j}]" for j in range(len(cutsT)))
f.append(f"anoisesrc=d=0.35:c=pink:a=0.6,highpass=f=900,lowpass=f=6000,afade=t=in:d=0.12,afade=t=out:st=0.12:d=0.23,volume=0.22,asplit={len(cutsT)}"+wh)
for j,t in enumerate(cutsT):
    ms=int(max(0,t-0.18)*1000); f.append(f"[w{j}]adelay={ms}|{ms}[d{j}]")
f.append(f"[{ai}:a]highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,loudnorm=I=-15:TP=-1.5:LRA=9[vo]")
f.append(f"[vo]"+"".join(f"[d{j}]" for j in range(len(cutsT)))+f"amix=inputs={len(cutsT)+1}:normalize=0,alimiter=limit=0.95[aout]")
sh(["ffmpeg","-y","-loglevel","error",*inp,"-filter_complex",";".join(f),"-map","[vout]","-map","[aout]","-t",f"{C['end']+1.5:.2f}","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart","../gravity-product-demo-final.mp4"])
print("done")

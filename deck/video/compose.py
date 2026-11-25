#!/usr/bin/env python3
"""Compose the Gravity product video from the recorded walkthrough.

Inputs (in deck/video/build/): raw/*.webm, markers.json, narration.json, vo/<id>.aiff
Optional: --voice path/to/voiceover.m4a (your own single-take narration; sections auto-split on ~1s silences)
Output: deck/video/gravity-product-demo.mp4
"""
import json, subprocess, sys, glob, os, re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build")
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
W, H, FPS = 1920, 1080, 30
INTRO, OUTRO, FF_LEN = 5.0, 7.0, 6.0
OUT = os.path.join(HERE, "gravity-product-demo.mp4")

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-2000:]); sys.exit(1)
    return r.stdout

def dur(p):
    return float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).strip())

def font(size, bold=False, light=False):
    idx = 1 if bold else (7 if light else 0)
    try: return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size, index=idx)
    except Exception: return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)

# ───────── graphics ─────────
def caption_png(title, sub, path):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    ft, fs = font(34, bold=True), font(24)
    tw = max(d.textlength(title, font=ft), d.textlength(sub, font=fs))
    x, y, pw, ph = 56, H - 196, int(tw) + 92, 118
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x + 4, y + 10, x + pw + 4, y + ph + 10), 18, fill=(0, 0, 0, 70))
    im = Image.alpha_composite(im, shadow.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((x, y, x + pw, y + ph), 18, fill=(255, 255, 255, 246), outline=(226, 224, 218, 255), width=2)
    d.ellipse((x + 30, y + 34, x + 44, y + 48), fill=(47, 91, 234, 255))
    d.text((x + 58, y + 20), title, font=ft, fill=(13, 13, 14, 255))
    d.text((x + 30, y + 70), sub, font=fs, fill=(110, 110, 118, 255))
    im.save(path)

def ff_badge_png(path, factor):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = f"»  {factor:.0f}x speed  ·  agents researching the live web"
    f = font(26, bold=True)
    tw = d.textlength(t, font=f)
    x, y = W - int(tw) - 110, 110
    d.rounded_rectangle((x, y, x + tw + 50, y + 56), 28, fill=(13, 13, 14, 235))
    d.text((x + 25, y + 13), t, font=f, fill=(255, 255, 255, 255))
    im.save(path)

def intro_png(path):
    bg = Image.new("RGB", (W, H), (7, 7, 12))
    hero = Image.open(os.path.join(ROOT, "assets", "hero.png")).convert("RGB")
    hero = hero.resize((W, int(hero.height * W / hero.width)), Image.LANCZOS)
    bg.paste(hero, (0, (H - hero.height) // 2))
    d = ImageDraw.Draw(bg)
    f = font(24)
    s = "HackwithBay 4.0  ·  Built with Teamily.ai · RocketRide · HotData · Flexprice · Moss"
    d.text(((W - d.textlength(s, font=f)) / 2, H - 70), s, font=f, fill=(170, 170, 180))
    bg.save(path)

def outro_png(path):
    bg = Image.new("RGB", (W, H), (245, 244, 240))
    d = ImageDraw.Draw(bg)
    for gx in range(0, W, 160): d.line((gx, 0, gx, H), fill=(234, 232, 226))
    for gy in range(0, H, 160): d.line((0, gy, W, gy), fill=(234, 232, 226))
    fb, fl = font(96, light=True), font(96, light=True)
    d.text((140, 300), "One sentence in.", font=fb, fill=(13, 13, 14))
    d.text((140, 410), "Booked meetings out.", font=fl, fill=(138, 138, 144))
    f2, f3 = font(30), font(26)
    d.text((140, 560), "Self-driving — but you hold the brakes and the wallet.", font=f2, fill=(58, 58, 64))
    d.rounded_rectangle((140, 650, 640, 712), 31, fill=(13, 13, 14))
    d.text((172, 664), "gravity-gtm.onrender.com", font=f3, fill=(255, 255, 255))
    d.rounded_rectangle((660, 650, 1180, 712), 31, outline=(200, 198, 192), width=2, fill=(255, 255, 255))
    d.text((692, 664), "github.com/vnmoorthy/gravity-gtm", font=f3, fill=(13, 13, 14))
    d.text((140, 800), "Built with  Teamily.ai  ·  RocketRide  ·  HotData  ·  Flexprice  ·  Moss  ·  Claude  ·  Band  ·  Render", font=font(24), fill=(110, 110, 118))
    d.text((140, 120), "GRAVITY", font=font(34, bold=True), fill=(13, 13, 14))
    bg.save(path)

# ───────── voice ─────────
def split_voice(voice, n):
    """Split a single-take voiceover into n sections on the longest silences."""
    log = subprocess.run(["ffmpeg", "-i", voice, "-af", "silencedetect=noise=-35dB:d=0.6", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    gaps = sorted([(e - s, s, e) for s, e in zip(starts, ends)], reverse=True)[: n - 1]
    cuts = sorted([(s + e) / 2 for _, s, e in gaps])
    total = dur(voice)
    bounds = [0.0] + cuts + [total]
    return [(bounds[i], bounds[i + 1]) for i in range(n)]

def main():
    voice = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else None
    N = json.load(open(os.path.join(B, "narration.json")))
    ids = [x["id"] for x in N]
    M = {m["id"]: m["t"] for m in json.load(open(os.path.join(B, "markers.json")))}
    raw = sorted(glob.glob(os.path.join(B, "raw", "*.webm")), key=os.path.getmtime)[-1]
    g = os.path.join(B, "gfx"); os.makedirs(g, exist_ok=True)

    t_in, ffs, ffe, t_end = M["intake"], M["ff_start"], M["ff_end"], M["end"]
    factor = max(1.0, (ffe - ffs) / FF_LEN)
    def omap(t):
        if t <= ffs: return INTRO + (t - t_in)
        if t <= ffe: return INTRO + (ffs - t_in) + (t - ffs) / factor
        return INTRO + (ffs - t_in) + (ffe - ffs) / factor + (t - ffe)
    body_end = omap(t_end)
    total = body_end + OUTRO

    # graphics
    intro_png(os.path.join(g, "intro.png")); outro_png(os.path.join(g, "outro.png")); ff_badge_png(os.path.join(g, "ff.png"), factor)
    shots = [i for i in ids if i in M and i not in ("intro",)]
    for x in N:
        if x["id"] in M and x["id"] != "intro": caption_png(x["caption"], x["sub"], os.path.join(g, f"cap_{x['id']}.png"))

    # 1) body video with speed ramp
    seg = os.path.join(B, "body.mp4")
    vf = f"[0:v]trim={t_in}:{ffs},setpts=PTS-STARTPTS[a];[0:v]trim={ffs}:{ffe},setpts=(PTS-STARTPTS)/{factor}[b];[0:v]trim={ffe}:{t_end},setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p[v]"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", raw, "-filter_complex", vf, "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", seg])

    # 2) captions + ff badge overlays on body
    cap = os.path.join(B, "body_cap.mp4")
    inputs, chains, last = ["-i", seg], [], "[0:v]"
    k = 1
    body_t = lambda t: omap(t) - INTRO
    for i, sid in enumerate(shots):
        start = body_t(M[sid]) + 0.25
        nxt = body_t(M[shots[i + 1]]) if i + 1 < len(shots) else body_end - INTRO
        end = min(nxt - 0.2, start + 6.5)
        inputs += ["-loop", "1", "-t", f"{body_end:.2f}", "-i", os.path.join(g, f"cap_{sid}.png")]
        chains.append(f"{last}[{k}:v]overlay=0:0:enable='between(t,{start:.2f},{end:.2f})'[o{k}]"); last = f"[o{k}]"; k += 1
    inputs += ["-loop", "1", "-t", f"{body_end:.2f}", "-i", os.path.join(g, "ff.png")]
    chains.append(f"{last}[{k}:v]overlay=0:0:enable='between(t,{body_t(ffs):.2f},{body_t(ffe):.2f})'[o{k}]"); last = f"[o{k}]"
    sh(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(chains), "-map", last, "-t", f"{body_end - INTRO:.2f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", cap])

    # 3) intro/outro cards + crossfades
    full = os.path.join(B, "full_v.mp4")
    bl = dur(cap)
    sh(["ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-t", f"{INTRO}", "-i", os.path.join(g, "intro.png"),
        "-i", cap,
        "-loop", "1", "-t", f"{OUTRO}", "-i", os.path.join(g, "outro.png"),
        "-filter_complex",
        f"[0:v]scale={W}:{H},fps={FPS},format=yuv420p,zoompan=z='min(zoom+0.0006,1.04)':d={int(INTRO*FPS)}:s={W}x{H}:fps={FPS},setsar=1[i];"
        f"[1:v]fps={FPS},format=yuv420p,setsar=1[b];[2:v]scale={W}:{H},fps={FPS},format=yuv420p,setsar=1[o];"
        f"[i][b]xfade=transition=fade:duration=0.6:offset={INTRO-0.6}[ib];[ib][o]xfade=transition=fade:duration=0.7:offset={INTRO-0.6+bl-0.7}[v]",
        "-map", "[v]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", full])
    vlen = dur(full)
    def final_t(t_out):  # body timeline shifted by crossfade overlap
        return t_out - 0.6
    # 4) audio: place narration sections
    if voice:
        secs = split_voice(voice, len(ids))
        clips = []
        for (a, b), sid in zip(secs, ids):
            p = os.path.join(B, f"vsec_{sid}.wav")
            sh(["ffmpeg", "-y", "-loglevel", "error", "-i", voice, "-ss", f"{a:.2f}", "-to", f"{b:.2f}", "-af", "silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse", p])
            clips.append((sid, p))
    else:
        clips = [(x["id"], os.path.join(B, "vo", f"{x['id']}.aiff")) for x in N]
    starts = {"intro": 0.5, "outro": vlen - OUTRO + 0.6}
    for sid in ids:
        if sid in M and sid != "intro": starts[sid] = final_t(omap(M[sid])) + 0.35
    ain, mix, j = [], [], 0
    for sid, p in clips:
        if sid not in starts: continue
        ain += ["-i", p]
        ms = int(starts[sid] * 1000)
        mix.append(f"[{j}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.6,adelay={ms}|{ms}[a{j}]"); j += 1
    # soft pad bed
    ain += ["-f", "lavfi", "-t", f"{vlen:.2f}", "-i", "sine=f=110:sample_rate=48000", "-f", "lavfi", "-t", f"{vlen:.2f}", "-i", "sine=f=164.8:sample_rate=48000", "-f", "lavfi", "-t", f"{vlen:.2f}", "-i", "sine=f=220:sample_rate=48000"]
    mix.append(f"[{j}:a][{j+1}:a][{j+2}:a]amix=inputs=3,lowpass=f=900,volume=0.05,tremolo=f=0.15:d=0.4,afade=t=in:d=3,afade=t=out:st={vlen-3:.2f}:d=3,aformat=channel_layouts=stereo[bed]")
    labels = "".join(f"[a{i}]" for i in range(j)) + "[bed]"
    mix.append(f"{labels}amix=inputs={j+1}:normalize=0,alimiter=limit=0.95[aout]")
    audio = os.path.join(B, "audio.m4a")
    sh(["ffmpeg", "-y", "-loglevel", "error", *ain, "-filter_complex", ";".join(mix), "-map", "[aout]", "-t", f"{vlen:.2f}", "-c:a", "aac", "-b:a", "192k", audio])
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", full, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", OUT])
    print(f"✓ {OUT}  ({dur(OUT):.1f}s, ff factor {factor:.1f}×, voice={'yours' if voice else 'synthetic'})")

if __name__ == "__main__":
    main()

#!/usr/bin/env bash
# Assemble the final Gravity demo video.
#   intro.mp4      – founder face-cam intro (~10 s, any resolution, with audio)
#   voiceover.m4a  – your narration over the product walkthrough (any length; the walkthrough is time-fitted to it)
#   outro.mp4      – founder face-cam outro (~10 s, with audio)
# Usage:  ./assemble.sh intro.mp4 voiceover.m4a outro.mp4   → gravity-demo-final.mp4
set -euo pipefail
cd "$(dirname "$0")"
INTRO="${1:-intro.mp4}"; VO="${2:-voiceover.m4a}"; OUTRO="${3:-outro.mp4}"
WALK="gravity-demo-silent.mp4"
for f in "$INTRO" "$VO" "$OUTRO" "$WALK"; do [ -f "$f" ] || { echo "missing $f"; exit 1; }; done

walk_d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WALK")
vo_d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VO")
ratio=$(python3 -c "print(${vo_d}/${walk_d})")
echo "walkthrough ${walk_d}s → fitted to voiceover ${vo_d}s (setpts ×${ratio})"

V='scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf5f4f0,fps=30,format=yuv420p'
ffmpeg -y -loglevel error -i "$INTRO" -vf "$V" -c:v libx264 -crf 20 -preset veryfast -c:a aac -ar 48000 -ac 2 _intro.mp4
ffmpeg -y -loglevel error -i "$OUTRO" -vf "$V" -c:v libx264 -crf 20 -preset veryfast -c:a aac -ar 48000 -ac 2 _outro.mp4
ffmpeg -y -loglevel error -i "$WALK" -i "$VO" -filter_complex "[0:v]setpts=${ratio}*PTS,${V}[v]" -map "[v]" -map 1:a -c:v libx264 -crf 20 -preset veryfast -c:a aac -ar 48000 -ac 2 -shortest _walk.mp4
printf "file '_intro.mp4'\nfile '_walk.mp4'\nfile '_outro.mp4'\n" > _list.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i _list.txt -c copy gravity-demo-final.mp4
rm -f _intro.mp4 _outro.mp4 _walk.mp4 _list.txt
echo "✓ gravity-demo-final.mp4 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 gravity-demo-final.mp4)s)"

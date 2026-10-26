#!/usr/bin/env bash
set -euo pipefail
mkdir -p video/cinematic
# Do not change the 18-second timeline or seek points. No cropping or frame interpolation.
VF="eq=contrast=1.035:brightness=0.003:saturation=1.075,unsharp=3:3:0.25:3:3:0.0"
for mode in full small; do
  if [[ "$mode" == full ]]; then base="descent"; else base="descent-540"; fi
  input="video/${base}.mp4"
  mp4="video/cinematic/${base}.mp4"
  webm="video/cinematic/${base}.webm"
  ffmpeg -hide_banner -loglevel error -y -i "$input" -map 0:v:0 -an -vf "$VF" -c:v libx264 -preset slow -crf 31 -pix_fmt yuv420p -movflags +faststart "$mp4"
  ffmpeg -hide_banner -loglevel error -y -i "$input" -map 0:v:0 -an -vf "$VF" -c:v libvpx-vp9 -deadline good -cpu-used 3 -crf 43 -b:v 0 "$webm"
  for output in "$mp4" "$webm"; do
    python3 - "$input" "$output" <<'PY'
import json, subprocess, sys
def probe(path):
    out=subprocess.check_output(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height,r_frame_rate,nb_frames,duration","-show_entries","format=duration","-of","json",path],text=True)
    p=json.loads(out)
    return p["streams"][0], float(p["format"]["duration"])
src, t1=probe(sys.argv[1]); dst, t2=probe(sys.argv[2])
assert abs(t1-t2)<0.05, f"Timing mismatch: {sys.argv[1]} {t1} vs {sys.argv[2]} {t2}"
assert (src["width"],src["height"],src["r_frame_rate"])==(dst["width"],dst["height"],dst["r_frame_rate"]), "Video geometry/fps changed"
print(sys.argv[2], "duration", round(t2,3), "fps", dst["r_frame_rate"],"resolution",dst["width"],dst["height"])
PY
  done
  # Do not replace the production-ready source with a bigger optimized encode.
  python3 - "$input" "$mp4" "$webm" <<'PY'
import os,sys
source,mp4,webm=sys.argv[1:]
print("Sizes:",source,os.path.getsize(source),mp4,os.path.getsize(mp4),webm,os.path.getsize(webm))
assert os.path.getsize(mp4) < os.path.getsize(source), "Optimized MP4 must be smaller than its source"
PY
done

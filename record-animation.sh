#!/bin/bash
# Record jarvis-hud-preview.html as MP4 using Chrome headless screenshots + ffmpeg
# Captures 192 frames at 24fps = 8 seconds

set -e

OUTDIR="/tmp/jarvis_record"
HTML_FILE="$(cd "$(dirname "$0")" && pwd)/jarvis-hud-preview.html"
OUTPUT="$(cd "$(dirname "$0")" && pwd)/Jarvis_Animation.mp4"
FRAMES=192
FPS=24
WIDTH=1280
HEIGHT=720

rm -rf "$OUTDIR"
mkdir -p "$OUTDIR"

echo "Recording $FRAMES frames at ${FPS}fps (${WIDTH}x${HEIGHT})..."

# Use Chrome DevTools Protocol to capture frames
# First, create a modified HTML that advances frame-by-frame instead of realtime
cat > "$OUTDIR/recorder.html" << 'HTMLEOF'
<!DOCTYPE html>
<html><head><style>
* { margin: 0; padding: 0; }
body { width: 1280px; height: 720px; overflow: hidden; }
iframe { border: none; width: 1280px; height: 720px; }
</style></head>
<body>
<iframe id="hud" src="PLACEHOLDER"></iframe>
</body></html>
HTMLEOF

# Replace placeholder with actual file path
sed -i '' "s|PLACEHOLDER|file://$HTML_FILE|" "$OUTDIR/recorder.html"

echo "Taking screenshots via Chrome headless..."

# Use Chrome headless to capture screenshots at intervals
# We'll take one screenshot per frame by using a Python script with CDP
python3 << 'PYEOF'
import subprocess, time, json, os, sys

outdir = "/tmp/jarvis_record"
html_file = os.environ.get("HTML_FILE", "")
frames = 192
width = 1280
height = 720

# Simple approach: take sequential screenshots using Chrome's --screenshot flag
# Chrome headless can capture a single frame, so we use a modified HTML that
# exposes frame control

# Create a self-contained HTML that renders each frame on demand via URL hash
html_path = f"{outdir}/capture.html"

# Read the original HTML
with open(html_file, 'r') as f:
    original = f.read()

# Modify to support frame-stepping: replace requestAnimationFrame loop with
# hash-based frame stepping
modified = original.replace(
    'requestAnimationFrame(draw);',
    '''// Frame capture mode: advance by hash parameter
    const targetFrame = parseInt(location.hash.slice(1)) || 0;
    if (phase * 60 < targetFrame) {
      requestAnimationFrame(draw);
    }'''
)

# Also need to call updateSIM right away
with open(html_path, 'w') as f:
    f.write(modified)

# Capture frames using Chrome headless screenshot
chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for i in range(frames):
    if i % 24 == 0:
        print(f"  Frame {i}/{frames}...")

    outfile = f"{outdir}/frame_{i:04d}.png"
    subprocess.run([
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--screenshot={outfile}",
        f"--window-size={width},{height}",
        "--hide-scrollbars",
        "--default-background-color=0",
        f"file://{html_path}#{i}"
    ], capture_output=True, timeout=10)

print(f"Captured {frames} frames")
PYEOF

echo "Assembling MP4 with ffmpeg..."
ffmpeg -y -framerate $FPS -i "$OUTDIR/frame_%04d.png" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -b:v 3M -movflags +faststart \
  "$OUTPUT"

echo "Done! Output: $OUTPUT"
echo "Size: $(du -h "$OUTPUT" | cut -f1)"

# Cleanup
rm -rf "$OUTDIR"

#!/usr/bin/env python3
"""
Record jarvis-recorder.html as MP4 using Chrome DevTools Protocol.
Captures deterministic frames via CDP screenshots, assembles with ffmpeg.
"""

import json
import os
import subprocess
import sys
import time
import http.client
import base64
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(SCRIPT_DIR, "jarvis-recorder.html")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "Jarvis_Animation.mp4")
FRAME_DIR = "/tmp/jarvis_frames"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
WIDTH = 1280
HEIGHT = 720
FPS = 24
DURATION = 8
TOTAL_FRAMES = FPS * DURATION
CDP_PORT = 9222


def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]


def cdp_send(ws, method, params=None):
    """Send CDP command via HTTP endpoint (simpler than websocket)."""
    pass


def main():
    # Clean up frame directory
    if os.path.exists(FRAME_DIR):
        shutil.rmtree(FRAME_DIR)
    os.makedirs(FRAME_DIR)

    port = find_free_port()
    html_url = f"file://{HTML_FILE}"

    print(f"Starting Chrome headless on port {port}...")
    chrome_proc = subprocess.Popen([
        CHROME,
        f"--headless=new",
        f"--remote-debugging-port={port}",
        f"--window-size={WIDTH},{HEIGHT}",
        "--disable-gpu",
        "--no-sandbox",
        "--hide-scrollbars",
        "--disable-extensions",
        "--disable-default-apps",
        "--no-first-run",
        "--mute-audio",
        "--remote-allow-origins=*",
        html_url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Wait for Chrome to start
    time.sleep(2)

    try:
        # Get the websocket URL for the page
        conn = http.client.HTTPConnection("127.0.0.1", port)
        conn.request("GET", "/json")
        resp = conn.getresponse()
        targets = json.loads(resp.read())
        conn.close()

        ws_url = None
        for t in targets:
            if t.get("type") == "page":
                ws_url = t.get("webSocketDebuggerUrl")
                break

        if not ws_url:
            print("ERROR: Could not find page target")
            return 1

        # Use websocket to communicate with CDP
        import websocket  # type: ignore
        ws = websocket.create_connection(ws_url)
        msg_id = 0

        def send_cmd(method, params=None):
            nonlocal msg_id
            msg_id += 1
            cmd = {"id": msg_id, "method": method}
            if params:
                cmd["params"] = params
            ws.send(json.dumps(cmd))
            while True:
                result = json.loads(ws.recv())
                if result.get("id") == msg_id:
                    return result
                # Skip events

        # Set viewport
        send_cmd("Emulation.setDeviceMetricsOverride", {
            "width": WIDTH, "height": HEIGHT,
            "deviceScaleFactor": 1, "mobile": False
        })

        # Wait for page to fully render
        time.sleep(1)

        print(f"Capturing {TOTAL_FRAMES} frames at {FPS}fps...")
        for frame in range(TOTAL_FRAMES):
            # Set the phase and render the frame deterministically
            phase = frame / FPS
            send_cmd("Runtime.evaluate", {
                "expression": f"drawFrame({phase})"
            })

            # Small delay to ensure render completes
            time.sleep(0.01)

            # Capture screenshot
            result = send_cmd("Page.captureScreenshot", {
                "format": "png",
                "clip": {"x": 0, "y": 0, "width": WIDTH, "height": HEIGHT, "scale": 1}
            })

            # Save frame
            img_data = base64.b64decode(result["result"]["data"])
            frame_path = os.path.join(FRAME_DIR, f"frame_{frame:04d}.png")
            with open(frame_path, "wb") as f:
                f.write(img_data)

            if frame % FPS == 0:
                print(f"  Frame {frame}/{TOTAL_FRAMES} ({frame * 100 // TOTAL_FRAMES}%)")

        ws.close()
        print(f"Captured {TOTAL_FRAMES} frames")

    finally:
        chrome_proc.terminate()
        chrome_proc.wait()

    # Assemble MP4 with ffmpeg
    print("Assembling MP4 with ffmpeg...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(FRAME_DIR, "frame_%04d.png"),
        "-c:v", "libx264",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-b:v", "3M",
        "-movflags", "+faststart",
        OUTPUT_FILE
    ], check=True)

    size = os.path.getsize(OUTPUT_FILE)
    print(f"Done! Output: {OUTPUT_FILE} ({size / 1024 / 1024:.1f} MB)")

    # Cleanup
    shutil.rmtree(FRAME_DIR)
    return 0


def main_simple():
    """Simpler approach: use individual Chrome headless screenshots (no websocket needed)."""
    if os.path.exists(FRAME_DIR):
        shutil.rmtree(FRAME_DIR)
    os.makedirs(FRAME_DIR)

    # Create a special HTML for each frame that renders a single static frame
    # by injecting the phase value directly
    print(f"Reading template HTML...")
    with open(HTML_FILE, 'r') as f:
        template = f.read()

    print(f"Capturing {TOTAL_FRAMES} frames at {FPS}fps using Chrome headless...")

    for frame in range(TOTAL_FRAMES):
        phase = frame / FPS
        frame_path = os.path.join(FRAME_DIR, f"frame_{frame:04d}.png")

        # Create a frame-specific HTML that auto-renders at the right phase
        frame_html_path = os.path.join(FRAME_DIR, "current_frame.html")
        frame_html = template.replace(
            "// ── INIT ────────────────────────────────────────────────────",
            f"// ── INIT (frame {frame}) ──────────────────────────────────"
        ).replace(
            "if (location.search.includes('record=1') || window.__RECORD) {",
            f"phase = {phase}; drawFrame({phase}); if (false) {{"
        ).replace(
            "} else {\n  // Normal preview mode\n  animLoop();\n}",
            "}"
        )
        with open(frame_html_path, 'w') as f:
            f.write(frame_html)

        # Capture with Chrome headless
        subprocess.run([
            CHROME,
            "--headless=new",
            f"--screenshot={frame_path}",
            f"--window-size={WIDTH},{HEIGHT}",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            "--default-background-color=00000000",
            f"file://{frame_html_path}"
        ], capture_output=True, timeout=15)

        if frame % FPS == 0:
            print(f"  Frame {frame}/{TOTAL_FRAMES} ({frame * 100 // TOTAL_FRAMES}%)")

    # Assemble MP4
    print("Assembling MP4 with ffmpeg...")
    subprocess.run([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(FRAME_DIR, "frame_%04d.png"),
        "-c:v", "libx264",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-b:v", "3M",
        "-movflags", "+faststart",
        OUTPUT_FILE
    ], check=True)

    size = os.path.getsize(OUTPUT_FILE)
    print(f"Done! Output: {OUTPUT_FILE} ({size / 1024 / 1024:.1f} MB)")
    shutil.rmtree(FRAME_DIR)
    return 0


if __name__ == "__main__":
    # Try CDP approach first (fast), fall back to simple approach
    try:
        import websocket  # type: ignore
        sys.exit(main())
    except ImportError:
        print("websocket-client not available, using simple capture mode (slower)...")
        sys.exit(main_simple())

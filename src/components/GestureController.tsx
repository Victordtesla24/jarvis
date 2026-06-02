import React, { useEffect, useRef, useState } from 'react';
import { GestureRecognizer } from '@mediapipe/tasks-vision';
import { MediaPipeService } from '../services/mediapipeService';
import { HandTrackingState, HandInteractionData, Landmark } from '../types';

// Opt-in two-hand gesture control. When mounted it engages the webcam + MediaPipe,
// derives JARVIS-style interaction data (expansion, pinch, joystick rotation) for
// each hand, and writes it straight into the shared handTrackingRef every frame —
// no React re-renders in the hot path. Unmounting fully releases the camera.

interface GestureControllerProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
}

// MediaPipe hand landmark indices.
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;
const INDEX_MCP = 5;
const PINKY_MCP = 17;

function dist(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function deriveHand(
  landmarks: Landmark[],
  handedness: 'Left' | 'Right',
  gesture: string | undefined,
): HandInteractionData {
  const wrist = landmarks[WRIST];
  // Palm scale = wrist→index-MCP, used to normalise distances regardless of depth.
  const palm = Math.max(dist(wrist, landmarks[INDEX_MCP]), 0.0001);

  const pinchRaw = dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / palm;
  const pinchDistance = Math.min(pinchRaw, 1);
  const isPinching = pinchRaw < 0.6;

  // Expansion: mean fingertip spread from the wrist, normalised by palm size.
  const tips = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP, THUMB_TIP];
  const spread = tips.reduce((s, i) => s + dist(landmarks[i], wrist), 0) / tips.length / palm;
  const expansionFactor = Math.max(0, Math.min(1, (spread - 1.0) / 1.4));

  // Joystick: palm centre offset from screen centre → [-1, 1]. Mirror X for Left.
  const cx = (landmarks[INDEX_MCP].x + landmarks[PINKY_MCP].x) / 2;
  const cy = (landmarks[INDEX_MCP].y + landmarks[PINKY_MCP].y) / 2;
  const rx = Math.max(-1, Math.min(1, (cx - 0.5) * 2));
  const ry = Math.max(-1, Math.min(1, (cy - 0.5) * 2));

  return {
    landmarks,
    handedness,
    gesture,
    pinchDistance,
    isPinching,
    expansionFactor,
    rotationControl: { x: handedness === 'Left' ? -rx : rx, y: ry },
  };
}

const GestureController: React.FC<GestureControllerProps> = ({ handTrackingRef }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let recognizer: GestureRecognizer | null = null;

    const loop = () => {
      const video = videoRef.current;
      if (!cancelled && recognizer && video && video.readyState >= 2) {
        let result;
        try {
          result = recognizer.recognizeForVideo(video, performance.now());
        } catch {
          result = null;
        }
        const next: HandTrackingState = { leftHand: null, rightHand: null };
        if (result?.landmarks?.length) {
          result.landmarks.forEach((lm, i) => {
            const cat = result!.handednesses?.[i]?.[0]?.categoryName as 'Left' | 'Right' | undefined;
            // MediaPipe handedness is from the camera's view; the user's mirrored feed
            // flips it, so we swap to match what the operator sees on screen.
            const handedness: 'Left' | 'Right' = cat === 'Right' ? 'Left' : 'Right';
            const gesture = result!.gestures?.[i]?.[0]?.categoryName;
            const hand = deriveHand(lm as Landmark[], handedness, gesture);
            if (handedness === 'Left') next.leftHand = hand;
            else next.rightHand = hand;
          });
        }
        handTrackingRef.current = next;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        recognizer = await MediaPipeService.initialize();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setReady(true);
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gesture link failed.');
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      handTrackingRef.current = { leftHand: null, rightHand: null };
    };
  }, [handTrackingRef]);

  return (
    <>
      {/* Mirrored, faint live feed so the operator can see their hands. */}
      <video
        ref={videoRef}
        muted
        playsInline
        className="absolute bottom-6 left-6 z-40 w-40 h-30 object-cover rounded border border-holo-cyan/40 pointer-events-none"
        style={{ transform: 'scaleX(-1)', opacity: 0.5, boxShadow: '0 0 20px rgba(0,240,255,0.25)' }}
      />
      <div className="absolute bottom-[140px] left-6 z-40 text-[9px] tracking-[0.2em] font-display pointer-events-none">
        {error ? (
          <span className="text-alert-red">GESTURE LINK ERROR: {error}</span>
        ) : ready ? (
          <span className="text-holo-cyan/70">◉ GESTURE LINK ACTIVE — TWO-HAND TRACKING</span>
        ) : (
          <span className="text-holo-cyan/50 animate-pulse">◌ ENGAGING OPTICAL SENSORS…</span>
        )}
      </div>
    </>
  );
};

export default GestureController;

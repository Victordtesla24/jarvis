import React, { useEffect, useRef, useState } from 'react';
import { HandTrackingState } from '../types';

interface GestureDebugOverlayProps {
  handTrackingRef: React.MutableRefObject<HandTrackingState>;
}

// Live proof the camera → MediaPipe → handTrackingRef pipeline is wired
// end-to-end. handTrackingRef is mutated every frame by <VideoFeed> and never
// triggers React re-renders, so this overlay polls it on its own rAF loop and
// mirrors the exact values both the reactor and globe consume. Hidden by
// default; shown when the URL has ?debug or the user clicks the corner button.
const GestureDebugOverlay: React.FC<GestureDebugOverlayProps> = ({ handTrackingRef }) => {
  const [visible, setVisible] = useState(() => {
    try { return new URLSearchParams(window.location.search).has('debug'); } catch { return false; }
  });

  // Snapshot of the ref, refreshed on a rAF loop only while visible.
  const [snap, setSnap] = useState<HandTrackingState>({ leftHand: null, rightHand: null });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      const s = handTrackingRef.current;
      setSnap((prev) =>
        prev.leftHand === s.leftHand && prev.rightHand === s.rightHand
          ? prev
          : { leftHand: s.leftHand, rightHand: s.rightHand });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible, handTrackingRef]);

  const { leftHand, rightHand } = snap;
  const fmt = (n: number) => (n >= 0 ? ' ' : '') + n.toFixed(2);
  const rc = rightHand?.rotationControl ?? { x: 0, y: 0 };
  const expPct = Math.round((leftHand?.expansionFactor ?? 0) * 100);
  const pinch = (leftHand?.isPinching ?? false) || (rightHand?.isPinching ?? false);

  return (
    <>
      {/* Tiny always-present toggle (bottom-left corner) so the overlay is
          reachable without editing the URL. */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        title="Toggle gesture debug overlay"
        style={{
          position: 'fixed',
          left: 6,
          bottom: 6,
          zIndex: 9999,
          width: 18,
          height: 18,
          lineHeight: '16px',
          fontFamily: 'monospace',
          fontSize: 11,
          color: visible ? '#050A14' : '#1AE6F5',
          background: visible ? '#1AE6F5' : 'rgba(5,10,20,0.6)',
          border: '1px solid #1AE6F5',
          borderRadius: 3,
          cursor: 'pointer',
          padding: 0,
          opacity: 0.55,
        }}
      >
        ⊙
      </button>

      {visible && (
        <div
          data-testid="gesture-debug-overlay"
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 9998,
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.45,
            color: '#1AE6F5',
            background: 'rgba(5,10,20,0.78)',
            border: '1px solid rgba(26,230,245,0.45)',
            borderRadius: 4,
            padding: '6px 8px',
            pointerEvents: 'none',
            whiteSpace: 'pre',
            textShadow: '0 0 4px rgba(26,230,245,0.5)',
          }}
        >
          <div style={{ color: '#FFC800', fontWeight: 700 }}>GESTURE DEBUG</div>
          <div>L hand : {leftHand ? 'YES' : 'no '}   R hand : {rightHand ? 'YES' : 'no '}</div>
          <div>rotX   : {fmt(rc.x)}   rotY : {fmt(rc.y)}</div>
          <div>expand : {String(expPct).padStart(3, ' ')}%</div>
          <div>pinch  : <span style={{ color: pinch ? '#FF2633' : '#668494' }}>{pinch ? 'PINCH' : '----'}</span></div>
        </div>
      )}
    </>
  );
};

export default GestureDebugOverlay;

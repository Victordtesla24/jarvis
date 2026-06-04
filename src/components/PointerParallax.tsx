import React, { useEffect, useRef } from 'react';

// Pointer-driven parallax — the dashboard's non-camera interaction pathway. Translates
// its layer a few px against (near layers) or with (far layers) the cursor to give the
// flat HUD genuine holographic depth as the operator moves the mouse. rAF-throttled and
// GPU-composited (translate3d), and fully disabled under prefers-reduced-motion so the
// HUD holds perfectly still for motion-sensitive users.

interface PointerParallaxProps {
  /** Max px the layer shifts at the screen edge. Kept small (≤6) for a subtle effect. */
  strength?: number;
  /** Near layers (panels) move against the cursor; far layers (backdrop) move with it. */
  invert?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const PointerParallax: React.FC<PointerParallaxProps> = ({
  strength = 5,
  invert = false,
  className,
  style,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1; // [-1, 1]
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      const s = invert ? -strength : strength;
      tx = nx * s;
      ty = ny * s;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength, invert]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ transition: 'transform 0.15s ease-out', willChange: 'transform', ...style }}
    >
      {children}
    </div>
  );
};

export default PointerParallax;

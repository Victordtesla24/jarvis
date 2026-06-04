# GSAP + Wawa VFX + React-Spring Reference

> Agent: implement Steps 4, 5, and 6 from ANIMATION_SPEC.md using the exact patterns below.

---

## STEP 4 — GSAP Counter Animations (JarvisConsole.tsx)

### Install
```bash
npm install gsap
```

### Implementation Pattern

```tsx
// src/components/JarvisConsole.tsx — ADD these imports:
import gsap from 'gsap'

// ADD this utility inside the component or as a module-level helper:
function animateCounter(
  el: HTMLElement,
  from: number,
  to: number,
  duration = 2.0
): gsap.core.Tween {
  const obj = { value: from }
  return gsap.to(obj, {
    value: to,
    duration,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = Math.round(obj.value).toString()
    },
  })
}

// In useEffect where numeric readouts mount — example for CPU counter:
useEffect(() => {
  const cpuEl = cpuRef.current
  if (!cpuEl) return
  const tween = animateCounter(cpuEl, 0, 87, 2.5)
  return () => { tween.kill() }
}, [])

// Repeat pattern for: memory%, uptime seconds, packet count, etc.
```

### Staggered Line Reveal with GSAP Timeline

```tsx
useEffect(() => {
  const lines = linesRef.current?.querySelectorAll('.console-line')
  if (!lines?.length) return

  const tl = gsap.timeline()
  tl.fromTo(
    lines,
    { opacity: 0, x: -20 },
    {
      opacity: 1,
      x: 0,
      duration: 0.3,
      stagger: 0.08,
      ease: 'power2.out',
    }
  )

  return () => { tl.kill() }
}, [lines]) // re-run when console lines change
```

---

## STEP 5 — Wawa VFX Particle Bursts (HUDOverlay.tsx)

### Install
```bash
npm install wawa-vfx
```

### Implementation — Inside Canvas (R3F context required)

```tsx
// src/components/HUDOverlay.tsx — ADD:
import { VFXParticles, VFXEmitter } from 'wawa-vfx'

// Ambient floating particles around the globe:
export function AmbientDataParticles() {
  return (
    <VFXParticles
      name="ambient-data"
      settings={{
        nbParticles: 150,
        renderMode: 'billboard',
        renderOrder: 2,
      }}
    >
      <VFXEmitter
        emitter="ambient-data"
        settings={{
          duration: Infinity,
          nbParticles: 1,
          spawnMode: 'time',
          loop: true,
          startPositionMin: [-3, -3, -3],
          startPositionMax: [3, 3, 3],
          startColor: [[0.788, 0.659, 0.298, 1]],  // #C9A84C in linear
          endColor: [[0.298, 0.792, 0.788, 0]],     // #4CCAC9 fade out
          startSize: [0.02],
          endSize: [0.08],
          lifetime: [2, 4],
        }}
      />
    </VFXParticles>
  )
}

// HUD activation burst (call imperatively via ref):
export function HUDActivationBurst({ position }: { position: [number, number, number] }) {
  return (
    <VFXParticles
      name="hud-burst"
      settings={{
        nbParticles: 80,
        renderMode: 'billboard',
      }}
    >
      <VFXEmitter
        emitter="hud-burst"
        settings={{
          duration: 0.4,
          nbParticles: 60,
          spawnMode: 'burst',
          loop: false,
          startPositionMin: position.map(v => v - 0.1) as [number, number, number],
          startPositionMax: position.map(v => v + 0.1) as [number, number, number],
          startColor: [[0.788, 0.659, 0.298, 1]],
          endColor: [[0.788, 0.659, 0.298, 0]],
          startSize: [0.03],
          endSize: [0.0],
          lifetime: [0.3, 0.6],
          startVelocityMin: [-0.5, 0.5, -0.5],
          startVelocityMax: [0.5, 2.0, 0.5],
        }}
      />
    </VFXParticles>
  )
}
```

### Perf Budget

Total particles across all active `VFXParticles` components: **≤ 500**.  
Monitor with `r3f-perf` in dev: `npm install --save-dev r3f-perf`

```tsx
// Add inside Canvas during development:
import { Perf } from 'r3f-perf'
{import.meta.env.DEV && <Perf position="top-left" />}
```

---

## STEP 6 — React-Spring HUD Mount Physics

### Install
```bash
npm install @react-spring/three @react-spring/web
```

### Three.js Context (inside Canvas) — HUDOverlay.tsx

```tsx
// src/components/HUDOverlay.tsx — ADD:
import { useSpring, animated } from '@react-spring/three'

interface HUDPanelProps {
  visible: boolean
  position: [number, number, number]
  children: React.ReactNode
}

export function AnimatedHUDPanel({ visible, position, children }: HUDPanelProps) {
  const spring = useSpring({
    scale: visible ? 1 : 0.001,
    opacity: visible ? 1 : 0,
    config: { tension: 280, friction: 60, precision: 0.001 },
  })

  return (
    <animated.group
      position={position}
      scale={spring.scale}
    >
      {children}
    </animated.group>
  )
}
```

### DOM Context (outside Canvas) — any HUD DOM panel

```tsx
import { useSpring, animated } from '@react-spring/web'

const panelSpring = useSpring({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0px)' : 'translateY(20px)',
  config: { tension: 300, friction: 40 },
})

return (
  <animated.div style={panelSpring} className="hud-panel">
    {children}
  </animated.div>
)
```

### Constraints

- `@react-spring/three` → use inside `<Canvas>` only
- `@react-spring/web` → use outside `<Canvas>` only
- Never mix the two in the same component tree node

# Theatre.js Sequence Reference — BootSequence + JarvisConsole

> Agent: implement Theatre.js animation sequences exactly as specified. Read the constraints section before touching any existing file.

## Package Install

```bash
npm install @theatre/core @theatre/r3f
```

Add to `devDependencies` only:
```bash
npm install --save-dev @theatre/studio
```

## Project Bootstrap — `src/theatre/project.ts`

Create this file (new file is allowed — it does not replace any existing file):

```ts
// src/theatre/project.ts
import { getProject, types } from '@theatre/core'

// Inline state prevents needing a committed .json file
export const theatreProject = getProject('JARVIS-Holographic', {
  state: {}
})

export const bootSheet    = theatreProject.sheet('BootSequence')
export const consoleSheet = theatreProject.sheet('JarvisConsole')

export { types }
```

## Studio Guard — `src/main.tsx`

Add the studio initialisation (dev-only) BEFORE `ReactDOM.createRoot`:

```tsx
// src/main.tsx  — ADD these lines at the top, below existing imports
if (import.meta.env.DEV) {
  import('@theatre/studio').then(({ default: studio }) => {
    studio.initialize()
  })
}
```

## BootSequence.tsx — Sequence Migration

### What to find and remove
- All `setTimeout(...)` and `setInterval(...)` calls that drive reveal animations
- Any manual state machines (`step === 0 → step === 1 → ...`)

### What to add

```tsx
import { useEffect, useRef } from 'react'
import { bootSheet } from '../theatre/project'
import { types } from '@theatre/core'

// Define animated objects OUTSIDE the component (module scope):
const bootObj = bootSheet.object('boot-container', {
  opacity:     types.number(0, { range: [0, 1] }),
  translateY:  types.number(40, { range: [-100, 100] }),
  scale:       types.number(0.8, { range: [0, 2] }),
})

const lineReveal = bootSheet.object('line-reveal', {
  progress: types.number(0, { range: [0, 1] }),
})

// Inside the component:
export function BootSequence() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubContainer = bootObj.onValuesChange((values) => {
      if (!containerRef.current) return
      containerRef.current.style.opacity    = String(values.opacity)
      containerRef.current.style.transform  = `translateY(${values.translateY}px) scale(${values.scale})`
    })

    const unsubLine = lineReveal.onValuesChange((values) => {
      // drive line mask via CSS clip-path or custom logic
      if (containerRef.current) {
        containerRef.current.style.setProperty('--line-progress', String(values.progress))
      }
    })

    // Play the sequence
    const seq = bootSheet.sequence
    seq.play({ iterationCount: 1, range: [0, 3.5] })

    return () => {
      unsubContainer()
      unsubLine()
      seq.pause()
    }
  }, [])

  return (
    <div ref={containerRef} style={{ opacity: 0, transform: 'translateY(40px) scale(0.8)' }}>
      {/* existing boot content unchanged */}
    </div>
  )
}
```

## JarvisConsole.tsx — Console Stagger

```tsx
import { consoleSheet, types } from '../theatre/project'

const consoleObj = consoleSheet.object('console-lines', {
  linesVisible: types.number(0, { range: [0, 20] }),
  opacity:      types.number(0, { range: [0, 1] }),
})

// In component useEffect:
useEffect(() => {
  const unsub = consoleObj.onValuesChange(({ linesVisible, opacity }) => {
    setVisibleLineCount(Math.round(linesVisible))
    setContainerOpacity(opacity)
  })

  consoleSheet.sequence.play({ iterationCount: 1, range: [0, 2] })

  return () => {
    unsub()
    consoleSheet.sequence.pause()
  }
}, [])
```

## Keyframe Values (set via Theatre Studio in dev, or hardcode via state)

When shipping without the Studio UI, provide initial state inline in `getProject`:

```ts
export const theatreProject = getProject('JARVIS-Holographic', {
  state: {
    sheetsById: {
      BootSequence: {
        staticOverrides: { byObject: {} },
        sequence: {
          subUnitsPerUnit: 30,
          length: 3.5,
          tracks: {
            byId: {
              'opacity':    { __debugName: 'opacity',    type: 'BasicKeyframedTrack', keyframes: [{ id:'k0', position:0, connectedRight:true, handles:[0.5,0,0.5,1], value:0 }, { id:'k1', position:0.8, connectedRight:true, handles:[0.5,0,0.5,1], value:1 }] },
              'translateY': { __debugName: 'translateY', type: 'BasicKeyframedTrack', keyframes: [{ id:'k0', position:0, connectedRight:true, handles:[0.5,0,0.5,1], value:40 }, { id:'k1', position:0.8, connectedRight:true, handles:[0.5,0,0.5,1], value:0 }] },
              'scale':      { __debugName: 'scale',      type: 'BasicKeyframedTrack', keyframes: [{ id:'k0', position:0, connectedRight:true, handles:[0.5,0,0.5,1], value:0.8 }, { id:'k1', position:0.8, connectedRight:true, handles:[0.5,0,0.5,1], value:1 }] },
            }
          }
        }
      }
    }
  }
})
```

## Constraints Checklist

- [ ] `@theatre/studio` wrapped in `if (import.meta.env.DEV)` — never in production bundle
- [ ] All `onValuesChange` subscriptions returned in cleanup
- [ ] No `.json` project state file committed to repo
- [ ] Zero `setTimeout` survivors in BootSequence or JarvisConsole after migration
- [ ] `tsc --noEmit` passes after implementation

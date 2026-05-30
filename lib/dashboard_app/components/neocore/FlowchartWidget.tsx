import React from 'react'

type Step = {
  id: string
  label: string
}

type Edge = {
  from: string
  to: string
}

type FlowchartData = {
  steps: Step[]
  edges?: Edge[]
}

type Props = {
  content: string // JSON string containing FlowchartData
}

export default function FlowchartWidget({ content }: Props) {
  const markerId = `arrowhead-${React.useId()}`
  let data: FlowchartData | null = null
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed.steps)) {
      data = { steps: parsed.steps, edges: parsed.edges }
    }
  } catch (_) {
    // ignore parse errors
  }

  if (!data) {
    return <div className="widget-text">Invalid flowchart data</div>
  }

  const nodeWidth = 180
  const nodeHeight = 40
  const verticalGap = 80
  const startX = 30

  // Map step id to index order
  const stepMap = new Map<string, number>()
  data.steps.forEach((s, i) => stepMap.set(s.id, i))

  const nodes = data.steps.map((step, i) => {
    const x = startX
    const y = i * verticalGap + 20
    return (
      <g key={step.id}>
        <rect
          x={x}
          y={y}
          width={nodeWidth}
          height={nodeHeight}
          fill="rgba(0, 242, 255, 0.1)"
          stroke="var(--neon-cyan)"
          rx={6}
          ry={6}
        />
        <text
          x={x + nodeWidth / 2}
          y={y + nodeHeight / 2 + 4}
          textAnchor="middle"
          fill="var(--text-primary)"
          fontFamily="'Orbitron', sans-serif"
          fontSize="12"
        >
          {step.label}
        </text>
      </g>
    )
  })

  const edges = (data.edges || []).map((edge, idx) => {
    const fromIdx = stepMap.get(edge.from)
    const toIdx = stepMap.get(edge.to)
    if (fromIdx === undefined || toIdx === undefined) return null
    // Nodes are stacked vertically; connect the bottom edge of `from` to the
    // top edge of `to`, leaving a gap so the arrowhead sits clear of the box.
    const x = startX + nodeWidth / 2
    const startYPos = fromIdx * verticalGap + 20 + nodeHeight
    const endYPos = toIdx * verticalGap + 20
    return (
      <path
        key={`${edge.from}-${edge.to}-${idx}`}
        d={`M${x},${startYPos} L${x},${endYPos - 8}`}
        stroke="var(--neon-cyan)"
        strokeWidth={2}
        fill="none"
        markerEnd={`url(#${markerId})`}
        opacity={0.8}
      />
    )
  })

  const viewHeight = data.steps.length * verticalGap + 40

  return (
    <svg width="100%" height={viewHeight} className="widget-svg">
      <defs>
        <marker
          id={markerId}
          markerWidth={8}
          markerHeight={8}
          refX={6}
          refY={3}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--neon-cyan)" />
        </marker>
      </defs>
      {edges}
      {nodes}
    </svg>
  )
}

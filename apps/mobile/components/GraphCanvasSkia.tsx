import { useMemo } from "react"
import { Platform, useWindowDimensions } from "react-native"
import { Canvas, Circle, Group, Line, Text, matchFont, vec } from "@shopify/react-native-skia"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { useDerivedValue, useSharedValue } from "react-native-reanimated"
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force"
import {
  buildDegreeMap,
  nodeColorFor,
  nodeRadius,
  withSelfLinks,
  DEFAULT_SETTINGS,
  type GraphData,
  type GraphLink,
  type GraphNode,
} from "@hype/shared"

// System font — matchFont needs no bundled asset (unlike useFont). 11px matches web.
const font = matchFont({
  fontFamily: Platform.select({ ios: "Helvetica", default: "sans-serif" })!,
  fontSize: 11,
})

// Skia's color parser is happiest with 6-digit hex; alpha rides on the `opacity`
// prop instead of #RRGGBBAA. Same intent as the web link palette.
const LINK_STYLE: Record<string, { color: string; opacity: number }> = {
  self: { color: "#ffffff", opacity: 0.2 },
  brand: { color: "#a78bfa", opacity: 0.28 },
  relation: { color: "#ffffff", opacity: 0.3 },
  located_in: { color: "#67e8f9", opacity: 0.35 },
}

// Phase 4: static Skia render of a graph fixture with pan + pinch-zoom. Reuses the
// web layout math (d3-force + @hype/shared helpers); only the render is new. Live
// data + node-birth animation are Phase 5; per-node drag is deferred (pan/zoom is
// the milestone). ponytail: zoom is center-anchored, not focal — fine for a fixture.
export default function GraphCanvasSkia({
  data,
  background = DEFAULT_SETTINGS.background,
}: {
  data: GraphData
  background?: string
}) {
  const { width, height } = useWindowDimensions()

  // Settle the layout once. forceLink mutates each link's source/target from id
  // strings into node object refs, so after tick() the links carry {x,y} endpoints.
  const { nodes, links, degree } = useMemo(() => {
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }))
    const links: GraphLink[] = withSelfLinks(nodes, data.links).map((l) => ({ ...l }))
    const degree = buildDegreeMap(links)
    const sim = forceSimulation<GraphNode>(nodes)
      .force("link", forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80).strength(0.5))
      .force("charge", forceManyBody<GraphNode>().strength(-280))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide<GraphNode>().radius((d) => nodeRadius(degree[d.id] ?? 0) + 10))
      .stop()
    sim.tick(300)
    return { nodes, links, degree }
  }, [data, width, height])

  // Pan/zoom transform lives on the UI thread (shared values). Skia reads the
  // derived transform array directly, so gestures don't cross to JS per frame.
  const tx = useSharedValue(0)
  const ty = useSharedValue(0)
  const scale = useSharedValue(1)
  const startTx = useSharedValue(0)
  const startTy = useSharedValue(0)
  const startScale = useSharedValue(1)

  const pan = Gesture.Pan()
    .onStart(() => {
      startTx.value = tx.value
      startTy.value = ty.value
    })
    .onUpdate((e) => {
      tx.value = startTx.value + e.translationX
      ty.value = startTy.value + e.translationY
    })

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(6, startScale.value * e.scale))
    })

  const gesture = Gesture.Simultaneous(pan, pinch)

  const transform = useDerivedValue(() => [
    { translateX: tx.value },
    { translateY: ty.value },
    { scale: scale.value },
  ])

  return (
    <GestureDetector gesture={gesture}>
      <Canvas style={{ flex: 1, backgroundColor: background }}>
        <Group transform={transform}>
          {links.map((l) => {
            const s = l.source as GraphNode
            const t = l.target as GraphNode
            const style = LINK_STYLE[l.link_type ?? "relation"] ?? LINK_STYLE.relation
            return (
              <Line
                key={l.id}
                p1={vec(s.x ?? 0, s.y ?? 0)}
                p2={vec(t.x ?? 0, t.y ?? 0)}
                color={style.color}
                style="stroke"
                strokeWidth={1.25}
                opacity={style.opacity}
              />
            )
          })}
          {nodes.map((n) => {
            const r = nodeRadius(degree[n.id] ?? 0)
            const cx = n.x ?? 0
            const cy = n.y ?? 0
            return (
              <Group key={n.id}>
                <Circle cx={cx} cy={cy} r={r} color={nodeColorFor(n.topic, DEFAULT_SETTINGS.palette)} opacity={0.85} />
                {/* No text-anchor in Skia; approximate centering by half the label width. */}
                {font && (
                  <Text
                    x={cx - (font.measureText(n.title).width ?? 0) / 2}
                    y={cy + r + 13}
                    text={n.title}
                    font={font}
                    color="#ffffff"
                    opacity={0.8}
                  />
                )}
              </Group>
            )
          })}
        </Group>
      </Canvas>
    </GestureDetector>
  )
}

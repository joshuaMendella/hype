"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import * as d3 from "d3"
import { createClient } from "@/lib/supabase/client"
import type { GraphData, GraphNode, GraphLink, VaultNote } from "@/types/database"
import { parseAttributes } from "./parseAttributes"
import { nodeColorFor, DEFAULT_SETTINGS, type GraphSettings } from "@/lib/graph/palettes"

const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"))

// Size scales with connections — hubs are big, leaves are small
function nodeRadius(degree: number) {
  return Math.max(4, Math.min(20, 4 + Math.sqrt(degree + 1) * 4))
}

function noteToNode(note: Pick<VaultNote, "id" | "title" | "topic" | "path" | "intent" | "content_md" | "source" | "entity_type">): GraphNode {
  return {
    id: note.id,
    title: note.title,
    topic: note.topic,
    path: note.path,
    intent: note.intent ?? false,
    wordCount: note.content_md?.split(" ").length ?? 1,
    source: note.source,
    entity_type: note.entity_type ?? null,
    attributes: parseAttributes(note.content_md),
  }
}

interface Props {
  initialData: GraphData
  refreshTrigger?: number
  settings?: GraphSettings
}

export default function GraphCanvas({ initialData, refreshTrigger, settings = DEFAULT_SETTINGS }: Props) {
  const palette = settings.palette
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null)
  // Persist node positions between redraws so existing nodes don't jump
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})
  // Track which node IDs we've already drawn, so genuinely new nodes can animate in
  const seenNodeIdsRef = useRef<Set<string>>(new Set())
  const [graphData, setGraphData] = useState<GraphData>(initialData)

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current!)
    const savedTransform = zoomTransformRef.current
    svg.selectAll("*").remove()

    const width = svgRef.current!.clientWidth
    const height = svgRef.current!.clientHeight

    // Restore saved positions so existing nodes don't teleport on redraw
    const nodes: GraphNode[] = graphData.nodes.map((n) => ({
      ...n,
      x: positionsRef.current[n.id]?.x,
      y: positionsRef.current[n.id]?.y,
    }))
    const links: GraphLink[] = graphData.links.map((l) => ({ ...l }))

    // Connect "You" to the graph: the home screen should read as a portrait of the self,
    // not a floating dot. Synthesize (client-side, never persisted) an edge from the
    // _profile.md root to every top-level entity — i.e. nodes that don't already hang off
    // a brand. Items under a brand stay nested; everything else links straight to You.
    const profile = nodes.find((n) => n.path === "_profile.md")
    if (profile) {
      const targetId = (l: GraphLink) => (typeof l.target === "string" ? l.target : (l.target as GraphNode).id)
      const sourceId = (l: GraphLink) => (typeof l.source === "string" ? l.source : (l.source as GraphNode).id)
      const structuralLinks = links.filter((l) => l.link_type === "brand" || l.link_type === "relation" || l.link_type === "located_in")
      // located_in points contained→container, so its SOURCE is the child (opposite of brand/relation).
      const childId = (l: GraphLink) => (l.link_type === "located_in" ? sourceId(l) : targetId(l))
      const children = new Set(structuralLinks.map(childId))

      // You links to every ROOT (no incoming brand/relation edge); children nest under their parent.
      // But a pure cycle (e.g. event--"at"-->place + place--"hosts"-->event) has NO root, so the
      // root-only rule alone would leave its whole component floating free of You — the exact
      // "floating dot" this feature exists to prevent. Union-find the brand/relation graph and
      // anchor any rootless component to You with a single self edge.
      const parent = new Map<string, string>()
      for (const n of nodes) if (n.id !== profile.id) parent.set(n.id, n.id)
      const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r }
      for (const l of structuralLinks) {
        const s = sourceId(l), t = targetId(l)
        if (parent.has(s) && parent.has(t)) parent.set(find(s), find(t))
      }
      const rootedComponents = new Set<string>()
      for (const n of nodes) if (n.id !== profile.id && !children.has(n.id)) rootedComponents.add(find(n.id))

      const anchoredRootless = new Set<string>()
      for (const n of nodes) {
        if (n.id === profile.id) continue
        const comp = find(n.id)
        const isRoot = !children.has(n.id)
        const anchorRootless = !isRoot && !rootedComponents.has(comp) && !anchoredRootless.has(comp)
        if (anchorRootless) anchoredRootless.add(comp)
        if (isRoot || anchorRootless) {
          links.push({ id: `self-${n.id}`, source: profile.id, target: n.id, anchor_text: null, link_type: "self" })
        }
      }
    }

    // New nodes since the last draw — these animate in. Empty set on first load (nothing "new").
    const seen = seenNodeIdsRef.current
    const isFirstDraw = seen.size === 0
    const isNew = (id: string) => !isFirstDraw && !seen.has(id)

    // Degree map for node sizing
    const degreeMap: Record<string, number> = {}
    links.forEach((l) => {
      const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id
      const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id
      degreeMap[src] = (degreeMap[src] ?? 0) + 1
      degreeMap[tgt] = (degreeMap[tgt] ?? 0) + 1
    })

    const g = svg.append("g")

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    if (savedTransform) {
      svg.call(zoom.transform, savedTransform)
    }

    // Low alpha on updates — existing nodes barely move, new node settles in
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .alpha(savedTransform ? 0.3 : 1)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(80)
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>()
        .radius((d) => nodeRadius(degreeMap[d.id] ?? 0) + 10)
      )

    // Links — a knowledge graph's appeal IS its connectedness, so keep edges readable.
    // self (You→root): soft white spine; brand: purple; relation (entity→entity): stronger neutral.
    const linkStyle: Record<string, { stroke: string; width: number }> = {
      self:       { stroke: "#ffffff33", width: 1.25 },
      brand:      { stroke: "#a78bfa45", width: 1.25 },
      relation:   { stroke: "#ffffff4d", width: 1.25 },
      located_in: { stroke: "#67e8f955", width: 1.25 },
    }
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).stroke)
      .attr("stroke-width", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).width)

    // Relationship edges carry a label ("at", "with", …) — surface it on hover via a native
    // <title> child. (Node tooltips are the rich HTML ones; edges just get the plain label.)
    link.filter((d) => (d.link_type === "relation" || d.link_type === "located_in") && !!d.anchor_text)
      .append("title")
      .text((d) => d.anchor_text ?? "")

    const node = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )

    // Outer glow ring
    const glow = node.append("circle")
      .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 5)
      .attr("fill", (d) => nodeColorFor(d.topic, palette))
      .attr("opacity", 0.1)

    // Main circle — every node filled and colored by topic (one color axis)
    const core = node.append("circle")
      .attr("r", (d) => isNew(d.id) ? 0 : nodeRadius(degreeMap[d.id] ?? 0))
      .attr("fill", (d) => nodeColorFor(d.topic, palette))
      .attr("opacity", 0.85)

    // Dramatize node birth: new nodes scale in with an elastic pop + a one-shot glow pulse.
    core.filter((d) => isNew(d.id))
      .transition().duration(750).ease(d3.easeElasticOut.amplitude(1).period(0.5))
      .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
    glow.filter((d) => isNew(d.id))
      .attr("opacity", 0.5)
      .transition().duration(900).ease(d3.easeCubicOut)
      .attr("opacity", 0.1)

    // Remember what we've drawn so only truly-new nodes animate next time
    seenNodeIdsRef.current = new Set(nodes.map((n) => n.id))

    node.append("text")
      .text((d) => d.title)
      .attr("dy", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 13)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (degreeMap[d.id] ?? 0) >= 2 ? "11px" : "10px")
      .attr("fill", "#ffffffcc")
      .attr("pointer-events", "none")

    node
      .on("mouseenter", (event, d) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        const sub = d.entity_type ?? d.topic ?? ""
        const header = `<div class="font-medium text-white/90">${escHtml(d.title)}${sub ? ` <span class="text-white/40">· ${escHtml(sub)}</span>` : ""}</div>`
        const rows = (d.attributes ?? [])
          .map((a) => `<div><span class="text-white/45">${escHtml(a.label)}:</span> ${escHtml(a.value)}</div>`)
          .join("")
        tooltip.innerHTML = header + rows
        tooltip.style.opacity = "1"
        tooltip.style.left = `${event.pageX + 12}px`
        tooltip.style.top = `${event.pageY - 8}px`
        d3.select(event.currentTarget).select("circle:nth-child(2)")
          .transition().duration(120).attr("opacity", 1)
      })
      .on("mousemove", (event) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        tooltip.style.left = `${event.pageX + 12}px`
        tooltip.style.top = `${event.pageY - 8}px`
      })
      .on("mouseleave", (event) => {
        const tooltip = tooltipRef.current
        if (tooltip) tooltip.style.opacity = "0"
        d3.select(event.currentTarget).select("circle:nth-child(2)")
          .transition().duration(120).attr("opacity", 0.85)
      })

    simulation.on("tick", () => {
      // Save positions so they survive the next redraw
      nodes.forEach((n) => {
        if (n.x != null) positionsRef.current[n.id] = { x: n.x, y: n.y ?? 0 }
      })

      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0)

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Auto-fit only on first load
    if (!savedTransform) {
      simulation.on("end", () => {
        const bounds = (g.node() as SVGGElement).getBBox()
        if (!bounds.width || !bounds.height) return
        const scale = Math.min(0.85 / Math.max(bounds.width / width, bounds.height / height), 1.5)
        const tx = (width - scale * (bounds.x * 2 + bounds.width)) / 2
        const ty = (height - scale * (bounds.y * 2 + bounds.height)) / 2
        svg.transition().duration(600).call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        )
      })
    }
  }, [graphData, palette])

  useEffect(() => {
    draw()
    const observer = new ResizeObserver(draw)
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [draw])

  // Refresh graph after each chat reply — triggered by parent via refreshTrigger.
  // Extraction is fire-and-forget (after()), so there's no completion signal to await.
  // ponytail: poll twice instead of one blind wait — covers fast and slow extractions.
  // The seenNodeIds diff makes the second fetch idempotent (only new nodes animate).
  useEffect(() => {
    if (!refreshTrigger) return
    const supabase = createClient()
    const fetchGraph = async () => {
      const [{ data: notes }, { data: links }] = await Promise.all([
        supabase.from("vault_notes").select("id, title, topic, path, content_md, intent, source, entity_type"),
        supabase.from("vault_links").select("id, source_note_id, target_note_id, anchor_text, link_type"),
      ])
      if (!notes || !links) return
      setGraphData({
        nodes: notes.map(noteToNode),
        links: links.map((l) => ({
          id: l.id,
          source: l.source_note_id,
          target: l.target_note_id,
          anchor_text: l.anchor_text,
          link_type: l.link_type ?? null,
        })),
      })
    }
    const timers = [setTimeout(fetchGraph, 3000), setTimeout(fetchGraph, 6500)]
    return () => timers.forEach(clearTimeout)
  }, [refreshTrigger])

  return (
    <>
      <svg ref={svgRef} className="w-full h-full transition-colors duration-300" style={{ background: settings.background }} />
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none text-xs bg-black/85 text-white/80 px-2.5 py-1.5 rounded-md border border-white/10 opacity-0 transition-opacity duration-100 z-50 max-w-xs leading-relaxed"
      />
    </>
  )
}

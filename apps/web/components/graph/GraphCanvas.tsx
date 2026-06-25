"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import * as d3 from "d3"
import { createClient } from "@/lib/supabase/client"
import type { GraphData, GraphNode, GraphLink, VaultNote } from "@/types/database"

const TOPIC_COLORS: Record<string, string> = {
  Profile:  "#ffffff",
  Work:     "#60a5fa",
  Style:    "#f472b6",
  Food:     "#fb923c",
  Fitness:  "#4ade80",
  People:   "#a78bfa",
  Goals:    "#facc15",
  Insights: "#67e8f9",
}

const DEFAULT_COLOR = "#6b7280"

function nodeColor(topic: string | null) {
  return topic ? (TOPIC_COLORS[topic] ?? DEFAULT_COLOR) : DEFAULT_COLOR
}

// Size scales with connections — hubs are big, leaves are small
function nodeRadius(degree: number) {
  return Math.max(4, Math.min(20, 4 + Math.sqrt(degree + 1) * 4))
}

function noteToNode(note: VaultNote): GraphNode {
  return {
    id: note.id,
    title: note.title,
    topic: note.topic,
    path: note.path,
    wordCount: note.content_md?.split(" ").length ?? 1,
  }
}

interface Props {
  initialData: GraphData
}

export default function GraphCanvas({ initialData }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null)
  // Persist node positions between redraws so existing nodes don't jump
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})
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

    // Links — Obsidian-style: thin, slightly purple-tinted
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#a78bfa30")
      .attr("stroke-width", 1)

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
    node.append("circle")
      .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 5)
      .attr("fill", (d) => nodeColor(d.topic))
      .attr("opacity", 0.1)

    // Main circle
    node.append("circle")
      .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
      .attr("fill", (d) => nodeColor(d.topic))
      .attr("opacity", 0.85)

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
        tooltip.textContent = `${d.title}${d.topic ? ` · ${d.topic}` : ""}`
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
        const scale = 0.85 / Math.max(bounds.width / width, bounds.height / height)
        const tx = (width - scale * (bounds.x * 2 + bounds.width)) / 2
        const ty = (height - scale * (bounds.y * 2 + bounds.height)) / 2
        svg.transition().duration(600).call(
          zoom.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        )
      })
    }
  }, [graphData])

  useEffect(() => {
    draw()
    const observer = new ResizeObserver(draw)
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [draw])

  // Poll for new nodes every 8s — SSR cookie-based sessions don't work with postgres_changes realtime
  useEffect(() => {
    const supabase = createClient()
    const id = setInterval(async () => {
      const [{ data: notes }, { data: links }] = await Promise.all([
        supabase.from("vault_notes").select("id, title, topic, path, content_md"),
        supabase.from("vault_links").select("id, source_note_id, target_note_id, anchor_text"),
      ])
      if (!notes || !links) return
      setGraphData({
        nodes: notes.map(noteToNode),
        links: links.map((l) => ({
          id: l.id,
          source: l.source_note_id,
          target: l.target_note_id,
          anchor_text: l.anchor_text,
        })),
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <svg ref={svgRef} className="w-full h-full" style={{ background: "transparent" }} />
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none text-xs bg-black/80 text-white/80 px-2 py-1 rounded-md border border-white/10 opacity-0 transition-opacity duration-100 z-50"
      />
    </>
  )
}

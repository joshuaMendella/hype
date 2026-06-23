"use client"

import { useEffect, useRef, useCallback } from "react"
import * as d3 from "d3"
import type { GraphData, GraphNode, GraphLink } from "@/types/database"

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

function nodeRadius(wordCount: number) {
  return Math.max(5, Math.min(16, 5 + Math.sqrt(wordCount) * 1.2))
}

interface Props {
  data: GraphData
}

export default function GraphCanvas({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const draw = useCallback(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll("*").remove()

    const width = svgRef.current!.clientWidth
    const height = svgRef.current!.clientHeight

    // Deep-clone so D3 can mutate node positions
    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }))
    const links: GraphLink[] = data.links.map((l) => ({ ...l }))

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    const g = svg.append("g")

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance(90)
        .strength(0.4)
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(d.wordCount) + 8))

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ffffff10")
      .attr("stroke-width", 1.2)

    // Node groups
    const node = g.append("g")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on("drag", (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    // Glow rings for larger nodes
    node.append("circle")
      .attr("r", (d) => nodeRadius(d.wordCount) + 4)
      .attr("fill", (d) => nodeColor(d.topic))
      .attr("opacity", 0.08)

    // Main node circles
    node.append("circle")
      .attr("r", (d) => nodeRadius(d.wordCount))
      .attr("fill", (d) => nodeColor(d.topic))
      .attr("opacity", 0.9)

    // Labels
    node.append("text")
      .text((d) => d.title)
      .attr("dy", (d) => nodeRadius(d.wordCount) + 12)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "#ffffff60")
      .attr("pointer-events", "none")

    // Tooltip on hover
    node
      .on("mouseenter", (event, d) => {
        const tooltip = tooltipRef.current
        if (!tooltip) return
        tooltip.textContent = `${d.title}${d.topic ? ` · ${d.topic}` : ""}`
        tooltip.style.opacity = "1"
        tooltip.style.left = `${event.pageX + 12}px`
        tooltip.style.top = `${event.pageY - 8}px`

        d3.select(event.currentTarget).select("circle:nth-child(2)")
          .transition().duration(150)
          .attr("opacity", 1)
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
          .transition().duration(150)
          .attr("opacity", 0.9)
      })

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0)

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Auto-fit on load after simulation settles
    simulation.on("end", () => {
      const bounds = (g.node() as SVGGElement).getBBox()
      const scale = 0.85 / Math.max(bounds.width / width, bounds.height / height)
      const tx = (width - scale * (bounds.x * 2 + bounds.width)) / 2
      const ty = (height - scale * (bounds.y * 2 + bounds.height)) / 2
      svg.transition().duration(600).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    })
  }, [data])

  useEffect(() => {
    draw()
    const observer = new ResizeObserver(draw)
    if (svgRef.current) observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [draw])

  return (
    <>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "transparent" }}
      />
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none text-xs bg-black/80 text-white/80 px-2 py-1 rounded-md border border-white/10 opacity-0 transition-opacity duration-100 z-50"
        style={{ position: "fixed" }}
      />
    </>
  )
}

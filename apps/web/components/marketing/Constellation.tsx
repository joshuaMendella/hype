"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { DEMO_NODES, DEMO_LINKS, type DemoNode, type DemoLink } from "./graphData"

// The hero star field: the demo graph re-skinned as a constellation. Forked from
// DemoGraph (since deleted with the old page) rather than parameterized — the two
// skins share no runtime and DemoGraph dies with the old page.
// Nodes render as glowing stars (topic color washed toward starlight), links as
// faint constellation lines, labels on hubs only.

type SimNode = DemoNode & d3.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; kind: DemoLink["kind"] }

const W = 800
const H = 600
const radius = (n: DemoNode) => (n.id === "you" ? 10 : n.hub ? 6.5 : 4)
const starColor = (c: string) => d3.interpolateRgb(c, "#ffffff")(0.5)

export default function Constellation({
  className,
  fill = false,
}: {
  className?: string
  /** Cover the container (hero backdrop) instead of letterboxing inside it. */
  fill?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const svg = d3.select(svgRef.current!)
    svg.selectAll("*").remove()

    const nodes: SimNode[] = DEMO_NODES.map((n) => ({ ...n }))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: SimLink[] = DEMO_LINKS.map((l) => ({
      source: byId.get(l.s)!,
      target: byId.get(l.t)!,
      kind: l.kind,
    }))

    const g = svg.append("g").attr("class", reduce ? "" : "hype-float")

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .attr("opacity", 0)

    const node = g.append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")

    // Glow first, core second — append order matters: `reveal` below addresses these
    // positionally via circle:nth-child(1)/(2), so it stays glow-then-core.
    node.append("circle")
      .attr("r", (d) => radius(d) + 8)
      .attr("fill", (d) => starColor(d.color))
      .attr("opacity", 0)

    node.append("circle")
      .attr("r", 0)
      .attr("fill", (d) => starColor(d.color))
      .attr("opacity", 0.95)

    node.filter((d) => !!d.hub).append("text")
      .text((d) => d.label)
      .attr("dy", (d) => radius(d) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#ffffff")
      .attr("pointer-events", "none")
      .style("font-family", "var(--font-body), sans-serif")
      .attr("opacity", 0)

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).distance(90).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => radius(d) + 16))

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x ?? 0).attr("y1", (d) => d.source.y ?? 0)
        .attr("x2", (d) => d.target.x ?? 0).attr("y2", (d) => d.target.y ?? 0)
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Stagger the stars in on load so the sky reads as being drawn.
    const shown = new Set<string>()
    const reveal = (n: SimNode, animate: boolean) => {
      shown.add(n.id)
      const g2 = node.filter((d) => d.id === n.id)
      const c = g2.select<SVGCircleElement>("circle:nth-child(2)")
      const gl = g2.select<SVGCircleElement>("circle:nth-child(1)")
      const tx = g2.select<SVGTextElement>("text")
      if (animate && !reduce) {
        c.transition().duration(700).ease(d3.easeElasticOut.amplitude(1).period(0.5)).attr("r", radius(n))
        gl.attr("opacity", 0.4).transition().duration(900).ease(d3.easeCubicOut).attr("opacity", 0.16)
        tx.transition().delay(200).duration(400).attr("opacity", 0.55)
      } else {
        c.attr("r", radius(n))
        gl.attr("opacity", 0.16)
        tx.attr("opacity", 0.55)
      }
      link.transition().duration(animate ? 500 : 0)
        .attr("opacity", (d) => (shown.has(d.source.id) && shown.has(d.target.id) ? 0.18 : 0))
    }

    const timers: ReturnType<typeof setTimeout>[] = []
    if (reduce) {
      nodes.forEach((n) => reveal(n, false))
    } else {
      const ordered = [...nodes].sort((a, b) => a.revealAt - b.revealAt)
      ordered.forEach((n, i) => timers.push(setTimeout(() => reveal(n, true), 150 + i * 110)))
    }

    return () => { timers.forEach(clearTimeout); sim.stop() }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={fill ? "xMidYMid slice" : "xMidYMid meet"}
      className={className}
      aria-hidden="true"
    />
  )
}

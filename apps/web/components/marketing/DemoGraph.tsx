"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { DEMO_NODES, DEMO_LINKS, type DemoNode, type DemoLink } from "./graphData"

// A small, self-contained ambient force graph — the product's signature visual, rebuilt
// for a landing page. Deliberately NOT the app's GraphCanvas: no zoom (it would hijack page
// scroll), no Supabase, no drag. viewBox coords make it responsive with zero resize work.

type SimNode = DemoNode & d3.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; kind: DemoLink["kind"] }

const W = 800
const H = 600
const radius = (n: DemoNode) => (n.id === "you" ? 16 : n.hub ? 11 : 7)

// Theme-aware (dark/light values live in globals.css; .graph-dark pins dark inside phone mocks)
const LINK_STROKE: Record<DemoLink["kind"], string> = {
  self: "var(--g-link-self)",
  brand: "var(--g-link-brand)",
  relation: "var(--g-link-relation)",
}

export default function DemoGraph({
  progress = 1,
  className,
  fill = false,
  spread = 1,
}: {
  /** 0..1 — reveal nodes up to this threshold (growth scrubber). Default: all. */
  progress?: number
  className?: string
  /** Cover the container (hero backdrop) instead of letterboxing inside it. */
  fill?: boolean
  /** >1 pushes nodes outward — for backdrops where text owns the center. */
  spread?: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const applyRef = useRef<(p: number, animate: boolean) => void>(() => {})

  // Build the simulation once.
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
      .style("stroke", (d) => LINK_STROKE[d.kind])
      .attr("stroke-width", 1.25)
      .attr("opacity", 0)

    const node = g.append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")

    const glow = node.append("circle")
      .attr("r", (d) => radius(d) + 6)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0)

    const core = node.append("circle")
      .attr("r", 0)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.9)

    node.append("text")
      .text((d) => d.label)
      .attr("dy", (d) => radius(d) + 15)
      .attr("text-anchor", "middle")
      .attr("font-size", (d) => (d.hub ? "13px" : "11px"))
      .style("fill", (d) => (d.hub ? "var(--g-label-hub)" : "var(--g-label)"))
      .attr("pointer-events", "none")
      .style("font-family", "var(--font-body), sans-serif")
      .attr("opacity", 0)

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).distance(82 * spread).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-320 * spread))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => radius(d) + 14))

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x ?? 0).attr("y1", (d) => d.source.y ?? 0)
        .attr("x2", (d) => d.target.x ?? 0).attr("y2", (d) => d.target.y ?? 0)
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Reveal logic — a node is shown once progress passes its revealAt. Newly shown nodes
    // "pop" in (elastic), matching the app's node-birth moment. Links fade in with both ends.
    const shown = new Set<string>()
    const apply = (p: number, animate: boolean) => {
      nodes.forEach((n) => {
        const visible = n.revealAt <= p + 1e-6
        const was = shown.has(n.id)
        if (visible === was) return
        if (visible) shown.add(n.id); else shown.delete(n.id)

        const g2 = node.filter((d) => d.id === n.id)
        const c = g2.select<SVGCircleElement>("circle:nth-child(2)")
        const gl = g2.select<SVGCircleElement>("circle:nth-child(1)")
        const tx = g2.select<SVGTextElement>("text")
        if (visible && animate && !reduce) {
          c.transition().duration(700).ease(d3.easeElasticOut.amplitude(1).period(0.5)).attr("r", radius(n))
          gl.attr("opacity", 0.55).transition().duration(900).ease(d3.easeCubicOut).attr("opacity", 0.22)
          tx.transition().delay(200).duration(400).attr("opacity", 1)
        } else {
          c.transition().duration(250).attr("r", visible ? radius(n) : 0)
          gl.transition().duration(250).attr("opacity", visible ? 0.22 : 0)
          tx.transition().duration(250).attr("opacity", visible ? 1 : 0)
        }
      })
      link.transition().duration(animate ? 500 : 200)
        .attr("opacity", (d) => (shown.has(d.source.id) && shown.has(d.target.id) ? 1 : 0))
      if (animate) sim.alpha(0.5).restart()
    }
    applyRef.current = apply

    // First paint: stagger the initial nodes in so the load reads as the graph being drawn.
    const initial = progress
    if (reduce) {
      apply(initial, false)
    } else {
      const ordered = [...DEMO_NODES].filter((n) => n.revealAt <= initial + 1e-6).sort((a, b) => a.revealAt - b.revealAt)
      ordered.forEach((n, i) => {
        setTimeout(() => {
          shown.delete(n.id) // force a fresh "birth"
          apply(Math.max(initial, n.revealAt), true)
        }, 150 + i * 110)
      })
    }

    return () => { sim.stop() }
    // Build once; progress changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Growth scrubber: re-reveal when progress changes (no rebuild).
  useEffect(() => {
    applyRef.current(progress, true)
  }, [progress])

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

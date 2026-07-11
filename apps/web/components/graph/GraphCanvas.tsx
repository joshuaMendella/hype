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
  // Place titles that count as identity (home + current city) — these link to "You"; other places float.
  identityPlaces?: string[]
}

// Links — a knowledge graph's appeal IS its connectedness, so keep edges readable.
// self (You→root): soft white spine; brand: purple; relation (entity→entity): stronger neutral.
const linkStyle: Record<string, { stroke: string; width: number }> = {
  self:       { stroke: "#ffffff33", width: 1.25 },
  brand:      { stroke: "#a78bfa45", width: 1.25 },
  relation:   { stroke: "#ffffff4d", width: 1.25 },
  located_in: { stroke: "#67e8f955", width: 1.25 },
}

export default function GraphCanvas({ initialData, refreshTrigger, settings = DEFAULT_SETTINGS, identityPlaces }: Props) {
  const palette = settings.palette
  const svgRef = useRef<SVGSVGElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(null)
  // Persist node positions between renders so existing nodes don't jump
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({})
  // Track which node IDs we've already drawn, so genuinely new nodes can animate in
  const seenNodeIdsRef = useRef<Set<string>>(new Set())
  const [graphData, setGraphData] = useState<GraphData>(initialData)

  // Persistent D3 machinery — created once on mount, reused across renders
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const linksGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const nodesGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  // id → persistent node object, reused across renders so x/y/vx/vy carry over
  const nodeObjectsRef = useRef<Map<string, GraphNode>>(new Map())
  const degreeMapRef = useRef<Record<string, number>>({})
  // Current joined selections — read (and refreshed) each render, applied on every tick
  const linkSelRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null)
  const nodeSelRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null)

  // Init once: container, zoom behavior, link/node groups, and ONE persistent simulation.
  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    // Defensive: guards against duplicate <g> if this effect ever double-fires (e.g. dev Strict Mode).
    svg.selectAll("*").remove()

    const width = svgRef.current!.clientWidth
    const height = svgRef.current!.clientHeight

    const g = svg.append("g")
    gRef.current = g

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", (event) => {
        zoomTransformRef.current = event.transform
        g.attr("transform", event.transform)
      })
    svg.call(zoom)
    zoomRef.current = zoom

    linksGroupRef.current = g.append("g")
    nodesGroupRef.current = g.append("g")

    const simulation = d3.forceSimulation<GraphNode>([])
      .force("link", d3.forceLink<GraphNode, GraphLink>([]).id((d) => d.id).distance(80).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      // Gentle positional gravity: with You wired only to identity nodes, non-identity clusters are
      // disconnected components — forceCenter alone centers only their centroid and lets them drift
      // apart. A weak forceX/Y keeps every cluster framed without collapsing them into one blob.
      .force("x", d3.forceX(width / 2).strength(0.04))
      .force("y", d3.forceY(height / 2).strength(0.04))
      .force("collision", d3.forceCollide<GraphNode>().radius((d) => nodeRadius(degreeMapRef.current[d.id] ?? 0) + 10))

    simulation.on("tick", () => {
      // Save positions so they survive the next render
      nodeObjectsRef.current.forEach((n, id) => {
        if (n.x != null) positionsRef.current[id] = { x: n.x, y: n.y ?? 0 }
      })

      linkSelRef.current
        ?.attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0)

      nodeSelRef.current?.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Auto-fit only on first load. zoomTransformRef stays null until either the user
    // pans/zooms or this very auto-fit runs (which itself fires the zoom handler and
    // sets it) — so later "end" events (from subsequent renders reheating) are no-ops.
    simulation.on("end", () => {
      if (zoomTransformRef.current) return
      const node = gRef.current?.node()
      if (!node) return
      const bounds = node.getBBox()
      if (!bounds.width || !bounds.height) return
      const w = svgRef.current!.clientWidth
      const h = svgRef.current!.clientHeight
      const scale = Math.min(0.85 / Math.max(bounds.width / w, bounds.height / h), 1.5)
      const tx = (w - scale * (bounds.x * 2 + bounds.width)) / 2
      const ty = (h - scale * (bounds.y * 2 + bounds.height)) / 2
      svg.transition().duration(600).call(
        zoom.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale)
      )
    })

    simulationRef.current = simulation

    // Resize: recenter and gently reheat — no teardown, no rebuild.
    const observer = new ResizeObserver(() => {
      if (!svgRef.current) return
      const w = svgRef.current.clientWidth
      const h = svgRef.current.clientHeight
      simulation.force<d3.ForceCenter<GraphNode>>("center")?.x(w / 2).y(h / 2)
      simulation.alpha(0.3).restart()
    })
    observer.observe(svgRef.current!)

    return () => {
      observer.disconnect()
      simulation.stop()
    }
  }, [])

  const render = useCallback(() => {
    const g = gRef.current
    const zoom = zoomRef.current
    const linksGroup = linksGroupRef.current
    const nodesGroup = nodesGroupRef.current
    const simulation = simulationRef.current
    if (!g || !zoom || !linksGroup || !nodesGroup || !simulation || !svgRef.current) return

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // Reuse the same node objects across renders so x/y/vx/vy (and the simulation's grip
    // on them) survive — only genuinely-new ids get a fresh object. Stale ids are dropped.
    const nodeObjects = nodeObjectsRef.current
    const nextIds = new Set(graphData.nodes.map((n) => n.id))
    for (const id of Array.from(nodeObjects.keys())) {
      if (!nextIds.has(id)) nodeObjects.delete(id)
    }
    const nodes: GraphNode[] = graphData.nodes.map((n) => {
      const existing = nodeObjects.get(n.id)
      if (existing) {
        Object.assign(existing, n)
        return existing
      }
      // Fresh node — seed near the center so it settles in rather than flying in from a corner.
      const fresh: GraphNode = {
        ...n,
        x: positionsRef.current[n.id]?.x ?? width / 2 + (Math.random() - 0.5) * 40,
        y: positionsRef.current[n.id]?.y ?? height / 2 + (Math.random() - 0.5) * 40,
      }
      nodeObjects.set(n.id, fresh)
      return fresh
    })
    const links: GraphLink[] = graphData.links.map((l) => ({ ...l }))

    // Connect "You" only to IDENTITY-level nodes — the center is a portrait of the person (who
    // they know, where they're from / live now, what they do, what they're into), NOT a hub wired
    // to every purchase. Items, brands, and the places/events they touch stay ON the graph (being
    // there IS the relationship) but float in their own clusters instead of tethering to You. A
    // brand you use often is still just a brand; frequency doesn't make it identity.
    const profile = nodes.find((n) => n.path === "_profile.md")
    if (profile) {
      const IDENTITY_TYPES = new Set(["person", "org", "interest"])
      // A place is identity only if it's the user's home or current city (passed from base_profile).
      const identitySet = new Set((identityPlaces ?? []).map((s) => s.toLowerCase()))
      for (const n of nodes) {
        if (n.id === profile.id) continue
        const isIdentity =
          IDENTITY_TYPES.has(n.entity_type ?? "") ||
          (n.entity_type === "place" && identitySet.has(n.title.toLowerCase()))
        if (isIdentity) {
          links.push({ id: `self-${n.id}`, source: profile.id, target: n.id, anchor_text: null, link_type: "self" })
        }
      }
    }

    // New nodes since the last render — these animate in. Empty set on first load (nothing "new").
    const seen = seenNodeIdsRef.current
    const isFirstDraw = seen.size === 0
    const isNew = (id: string) => !isFirstDraw && !seen.has(id)

    // Fresh-vault moment: the very first draw with only the You node (onboarding) gets a
    // real birth — elastic pop, two ripple rings, and a breathing glow while it's alone.
    const bloomSolo = isFirstDraw && nodes.length === 1

    // Degree map for node sizing — also read by the collision force accessor via degreeMapRef.
    const degreeMap: Record<string, number> = {}
    links.forEach((l) => {
      const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id
      const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id
      degreeMap[src] = (degreeMap[src] ?? 0) + 1
      degreeMap[tgt] = (degreeMap[tgt] ?? 0) + 1
    })
    degreeMapRef.current = degreeMap

    // Links — keyed join so unchanged edges stay put in the DOM (no flash).
    const link = linksGroup
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links, (d) => d.id)
      .join(
        (enter) => {
          const sel = enter.append("line")
            .attr("stroke", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).stroke)
            .attr("stroke-width", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).width)
          // Relationship edges carry a label ("at", "with", …) — surface it on hover via a native
          // <title> child. (Node tooltips are the rich HTML ones; edges just get the plain label.)
          sel.filter((d) => (d.link_type === "relation" || d.link_type === "located_in") && !!d.anchor_text)
            .append("title")
            .text((d) => d.anchor_text ?? "")
          return sel
        },
        (update) =>
          update
            .attr("stroke", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).stroke)
            .attr("stroke-width", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).width),
        (exit) => exit.remove()
      )
    linkSelRef.current = link

    // Nodes — keyed join; only truly-new nodes get appended (and pop-animated).
    const node = nodesGroup
      .selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes, (d) => d.id)
      .join(
        (enter) => {
          const sel = enter.append("g")
            .attr("class", "node")
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
          const glow = sel.append("circle")
            .attr("class", "glow")
            .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 5)
            .attr("fill", (d) => nodeColorFor(d.topic, palette))
            .attr("opacity", 0.1)

          // Main circle — every node filled and colored by topic (one color axis)
          const core = sel.append("circle")
            .attr("class", "core")
            .attr("r", (d) => (isNew(d.id) || bloomSolo ? 0 : nodeRadius(degreeMap[d.id] ?? 0)))
            .attr("fill", (d) => nodeColorFor(d.topic, palette))
            .attr("opacity", 0.85)

          // Dramatize node birth: new nodes scale in with an elastic pop + a one-shot glow pulse.
          core.filter((d) => isNew(d.id) || bloomSolo)
            .transition().duration(750).ease(d3.easeElasticOut.amplitude(1).period(0.5))
            .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
          glow.filter((d) => isNew(d.id) || bloomSolo)
            .attr("opacity", 0.5)
            .transition().duration(900).ease(d3.easeCubicOut)
            .attr("opacity", 0.1)

          // Birth ripples — two one-shot expanding rings, then gone.
          if (bloomSolo) {
            for (const delay of [150, 550]) {
              sel.append("circle")
                .attr("fill", "none")
                .attr("stroke", (d) => nodeColorFor(d.topic, palette))
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.55)
                .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
                .transition().delay(delay).duration(1400).ease(d3.easeCubicOut)
                .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) * 6)
                .attr("opacity", 0)
                .remove()
            }
          }

          sel.append("text")
            .text((d) => d.title)
            .attr("dy", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 13)
            .attr("text-anchor", "middle")
            .attr("font-size", (d) => (degreeMap[d.id] ?? 0) >= 2 ? "11px" : "10px")
            .attr("fill", "#ffffffcc")
            .attr("pointer-events", "none")

          // Hover/drag handlers attached once on enter — never reattached on update.
          sel
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

          return sel
        },
        (update) => {
          // Recompute radius from the current degree map and recolor — handles palette
          // change and degree change. Never replay the birth pop for existing nodes.
          update.select<SVGCircleElement>("circle.glow")
            .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 5)
            .attr("fill", (d) => nodeColorFor(d.topic, palette))

          update.select<SVGCircleElement>("circle.core")
            .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
            .attr("fill", (d) => nodeColorFor(d.topic, palette))

          update.select<SVGTextElement>("text")
            .text((d) => d.title)
            .attr("dy", (d) => nodeRadius(degreeMap[d.id] ?? 0) + 13)
            .attr("font-size", (d) => (degreeMap[d.id] ?? 0) >= 2 ? "11px" : "10px")

          return update
        },
        (exit) => exit.remove()
      )
    nodeSelRef.current = node

    // A lone node breathes so a fresh graph feels alive; company arrives → back to static.
    const glows = nodesGroup.selectAll<SVGCircleElement, GraphNode>("circle.glow")
    if (nodes.length === 1) {
      const breathe = (s: d3.Selection<SVGCircleElement, GraphNode, d3.BaseType, unknown>) => {
        s.transition("breathe").duration(1600).ease(d3.easeSinInOut).attr("opacity", 0.32)
          .transition().duration(1600).ease(d3.easeSinInOut).attr("opacity", 0.1)
          .on("end", function () { breathe(d3.select(this as SVGCircleElement) as d3.Selection<SVGCircleElement, GraphNode, d3.BaseType, unknown>) })
      }
      breathe(glows)
    } else {
      glows.interrupt("breathe").attr("opacity", 0.1)
    }

    // Remember what we've drawn so only truly-new nodes animate next time
    seenNodeIdsRef.current = new Set(nodes.map((n) => n.id))

    // Feed the persistent simulation the current arrays and reheat.
    // Low alpha on updates — existing nodes barely move, new nodes settle in.
    simulation.nodes(nodes)
    simulation.force<d3.ForceLink<GraphNode, GraphLink>>("link")?.links(links)
    simulation.alpha(zoomTransformRef.current ? 0.3 : 1).restart()
  }, [graphData, palette])

  useEffect(() => {
    render()
  }, [render])

  // Refresh graph after each chat reply — triggered by parent via refreshTrigger.
  // Extraction is fire-and-forget (after()), so there's no completion signal to await.
  // ponytail: poll twice instead of one blind wait — covers fast and slow extractions.
  // The keyed join makes the second fetch a visual no-op when data is unchanged.
  useEffect(() => {
    if (!refreshTrigger) return
    const supabase = createClient()
    const fetchGraph = async () => {
      const [{ data: notes }, { data: links }] = await Promise.all([
        supabase.from("vault_notes").select("id, title, topic, path, content_md, intent, source, entity_type").is("archived_at", null),
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

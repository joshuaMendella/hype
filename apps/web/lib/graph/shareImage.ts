// Renders the current graph SVG to a stylized PNG (2×, background + wordmark) and
// opens the native share sheet when available, else downloads. The graph is the
// product's most personal, most shareable object — this is the zero-budget viral loop
// (traction review 2026-07-11, finding #4).

export async function shareGraphImage(svgEl: SVGSVGElement, background: string): Promise<void> {
  const width = svgEl.clientWidth
  const height = svgEl.clientHeight

  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  // SVG text inherits the page font, which serialization loses — pin a fallback.
  clone.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", "system-ui, sans-serif"))

  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("svg rasterize failed"))
      img.src = svgUrl
    })

    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    ctx.scale(scale, scale)
    ctx.fillStyle = background || "#0a0a0f"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    // Wordmark — bottom-right, subtle.
    ctx.textAlign = "right"
    ctx.font = "600 18px system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText("hype", width - 20, height - 34)
    ctx.font = "400 11px system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.45)"
    ctx.fillText("my world, mapped by AI", width - 20, height - 18)

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"))
    if (!blob) throw new Error("toBlob failed")
    const file = new File([blob], "my-hype-graph.png", { type: "image/png" })

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      // User cancelling the sheet rejects — that's a non-error.
      await navigator.share({ files: [file], title: "My knowledge graph" }).catch(() => {})
    } else {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "my-hype-graph.png"
      a.click()
      URL.revokeObjectURL(a.href)
    }
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

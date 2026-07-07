"use client"

import { useState } from "react"

export type AdCard = { sponsor: string; name: string; price: string; image: string; url: string }

// Draft ad-moment card — rendered below the AI voice line when a consented ad
// offer comes back from /api/chat. Sponsorship label is always visible; never
// disguised as an organic recommendation.
export default function AdCardView({ card }: { card: AdCard | null }) {
  const [imgFailed, setImgFailed] = useState(false)

  if (!card) return null

  return (
    <div
      style={{
        maxWidth: "320px",
        margin: "18px auto 0",
        padding: "14px",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: "14px",
        fontFamily: "var(--font-poppins), sans-serif",
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          marginBottom: "10px",
        }}
      >
        Sponsored · {card.sponsor}
      </p>

      {!imgFailed && (
        <a href={card.url} target="_blank" rel="noopener noreferrer">
          <img
            src={card.image}
            alt={card.name}
            onError={() => setImgFailed(true)}
            style={{
              width: "100%",
              maxHeight: "220px",
              objectFit: "cover",
              borderRadius: "8px",
              display: "block",
              marginBottom: "10px",
            }}
          />
        </a>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
        <span style={{ color: "rgba(255,255,255,0.87)", fontSize: "0.95rem", fontWeight: 400 }}>
          {card.name}
        </span>
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem" }}>{card.price}</span>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

// Discriminated by `kind`: "ad" = paid sponsor card, "scout" = free info-only find
// (Ticketmaster/Bandsintown). Same card slot in ChatPanel, different visual treatment
// so a scout find never reads as a paid placement.
export type AdCard =
  | { kind: "ad"; sponsor: string; name: string; price: string; image: string; url: string }
  | { kind: "scout"; title: string; date: string; venue: string; url: string; source: string }

// Draft ad-moment / scout-find card — rendered below the AI voice line when a consented
// ad offer or a scout find comes back from /api/chat. Ad cards always show a visible
// "Sponsored" label; scout cards show a "Local find" label — never disguised as either.
export default function AdCardView({ card }: { card: AdCard | null }) {
  const [imgFailed, setImgFailed] = useState(false)

  if (!card) return null

  if (card.kind === "scout") {
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
          Local find · {card.source}
        </p>

        <a href={card.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <div style={{ color: "rgba(255,255,255,0.87)", fontSize: "0.95rem", fontWeight: 400, marginBottom: "4px" }}>
            {card.title}
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
            {card.date} · {card.venue}
          </div>
        </a>
      </div>
    )
  }

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

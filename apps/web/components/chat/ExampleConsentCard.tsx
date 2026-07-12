// apps/web/components/chat/ExampleConsentCard.tsx
"use client"

// A STATIC, translucent preview of what the assistant might ask when it spots something —
// NOT the real ad card (that redesign is deferred). The ghosted Yes/Not now make the
// per-moment consent gate visual; they are decorative and do nothing on click.
export default function ExampleConsentCard({ ask }: { ask: string }) {
  return (
    <div
      style={{
        maxWidth: "360px",
        width: "100%",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(8px)",
        padding: "18px 18px 14px",
        opacity: 0.85,
        fontFamily: "var(--font-poppins), sans-serif",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          margin: "0 0 10px",
        }}
      >
        example
      </p>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: 1.55,
          fontWeight: 300,
          color: "rgba(255,255,255,0.82)",
          margin: "0 0 16px",
        }}
      >
        {ask}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        {["Yes", "Not now"].map((label) => (
          <span
            key={label}
            aria-hidden
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 0",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.85rem",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

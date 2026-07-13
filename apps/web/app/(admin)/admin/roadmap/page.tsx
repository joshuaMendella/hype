import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ROADMAP, type ItemStatus, type RoadmapItem } from "@/lib/admin/roadmap"

// Defense in depth: the layout gates, but a layout and its page render concurrently,
// so the page re-checks the owner before rendering anything (same pattern as /admin).
export default async function RoadmapPage() {
  const ownerId = process.env.ADMIN_USER_ID
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!ownerId || !user || user.id !== ownerId) notFound()

  const allItems = ROADMAP.flatMap((a) => a.items)
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, allItems.filter((i) => i.status === s).length]),
  ) as Record<ItemStatus, number>
  const blockers = allItems.filter((i) => i.launchBlocker)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Roadmap</h1>

      <section className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StatusChip status={s} />
              <span className="text-neutral-300">{counts[s]}</span>
            </span>
          ))}
        </div>
        <div className="text-sm">
          <span className="text-red-400 font-medium">Launch blockers:</span>{" "}
          {blockers.length === 0 ? (
            <span className="text-neutral-400">none</span>
          ) : (
            <span className="text-neutral-300">{blockers.map((b) => b.title).join(" · ")}</span>
          )}
        </div>
      </section>

      {ROADMAP.map((area) => {
        const done = area.items.filter((i) => i.status === "done").length
        return (
          <section key={area.name} className="border border-neutral-800 rounded-lg bg-neutral-900/50">
            <div className="px-4 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-medium">{area.name}</h2>
                <span className="text-sm text-neutral-500 shrink-0">{done}/{area.items.length} done</span>
              </div>
              <p className="mt-1.5 mb-3 text-sm text-neutral-400 leading-relaxed">{area.principle}</p>
            </div>
            <ul>
              {area.items.map((item) => (
                <ItemRow key={item.title} item={item} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const STATUS_ORDER: ItemStatus[] = ["done", "built-unverified", "in-progress", "planned", "blocked"]

const STATUS_LABELS: Record<ItemStatus, string> = {
  done: "Done",
  "built-unverified": "Built — unverified",
  "in-progress": "In progress",
  planned: "Planned",
  blocked: "Blocked",
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  done: "bg-emerald-500/15 text-emerald-400",
  "built-unverified": "bg-amber-500/15 text-amber-400",
  "in-progress": "bg-sky-500/15 text-sky-400",
  planned: "bg-neutral-500/15 text-neutral-400",
  blocked: "bg-red-500/15 text-red-400",
}

function StatusChip({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ItemRow({ item }: { item: RoadmapItem }) {
  return (
    <li className="border-t border-neutral-800 px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <StatusChip status={item.status} />
      <span className="text-neutral-100">
        {item.title}
        {item.launchBlocker && <span className="ml-2 text-xs text-red-400 font-medium">LAUNCH BLOCKER</span>}
      </span>
      {item.note && <span className="text-neutral-400">{item.note}</span>}
      {item.doc && <span className="text-neutral-600 text-xs font-mono">{item.doc}</span>}
    </li>
  )
}

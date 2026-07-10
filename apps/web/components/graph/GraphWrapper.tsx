"use client"

import { useState, useEffect } from "react"
import GraphCanvas from "./GraphCanvas"
import ChatPanel from "@/components/chat/ChatPanel"
import UserMenu from "@/components/menu/UserMenu"
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GraphSettings } from "@/lib/graph/palettes"
import { isCurrentLocationFresh } from "@/lib/profile/currentLocation"
import type { GraphData } from "@/types/database"

interface Props {
  initialData: GraphData
  userId: string
  userName: string | null
  initialProfile: { display_name: string | null; base_profile: { age?: number; home_location?: string; current_location?: string; current_location_at?: string } }
  initialHistory?: { role: "user" | "assistant"; content: string }[]
}

export default function GraphWrapper({ initialData, userId, userName, initialProfile, initialHistory }: Props) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  // Load cosmetic graph settings client-side (localStorage) after mount to avoid
  // an SSR hydration mismatch; the 300ms canvas transition smooths the swap-in.
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS)
  useEffect(() => setSettings(loadSettings()), [])
  const updateSettings = (s: GraphSettings) => { setSettings(s); saveSettings(s) }

  return (
    <>
      <GraphCanvas
        initialData={initialData}
        refreshTrigger={refreshTrigger}
        settings={settings}
        // Home is always identity; current city only while its timestamp is fresh
        // (same 30-day TTL scout uses) — a stale current city floats off You.
        identityPlaces={[
          initialProfile.base_profile?.home_location,
          isCurrentLocationFresh(initialProfile.base_profile?.current_location_at)
            ? initialProfile.base_profile?.current_location
            : undefined,
        ].filter((s): s is string => !!s)}
      />
      <ChatPanel userId={userId} userName={userName} initialHistory={initialHistory} onReply={() => setRefreshTrigger((t) => t + 1)} />
      <UserMenu
        userId={userId}
        initialProfile={initialProfile}
        onNodeDeleted={() => setRefreshTrigger((t) => t + 1)}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </>
  )
}

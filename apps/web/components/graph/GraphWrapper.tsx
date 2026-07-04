"use client"

import { useState, useEffect } from "react"
import GraphCanvas from "./GraphCanvas"
import ChatPanel from "@/components/chat/ChatPanel"
import UserMenu from "@/components/menu/UserMenu"
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GraphSettings } from "@/lib/graph/palettes"
import type { GraphData } from "@/types/database"

interface Props {
  initialData: GraphData
  userId: string
  userName: string | null
  initialProfile: { display_name: string | null; base_profile: { age?: number; home_location?: string } }
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
      <GraphCanvas initialData={initialData} refreshTrigger={refreshTrigger} settings={settings} />
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

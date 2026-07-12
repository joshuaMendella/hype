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
  onboarded: boolean
}

export default function GraphWrapper({ initialData, userId, userName, initialProfile, initialHistory, onboarded }: Props) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS)
  useEffect(() => setSettings(loadSettings()), [])
  const updateSettings = (s: GraphSettings) => { setSettings(s); saveSettings(s) }

  // identityPlaces is state (not a derived const) so onboarding can add the freshly-seeded
  // home city live — a place links to "You" only if its title is in this list.
  const [identityPlaces, setIdentityPlaces] = useState<string[]>(
    [
      initialProfile.base_profile?.home_location,
      isCurrentLocationFresh(initialProfile.base_profile?.current_location_at)
        ? initialProfile.base_profile?.current_location
        : undefined,
    ].filter((s): s is string => !!s),
  )
  const addIdentityPlace = (city: string) =>
    setIdentityPlaces((prev) => (prev.includes(city) ? prev : [...prev, city]))

  return (
    <>
      <GraphCanvas
        initialData={initialData}
        refreshTrigger={refreshTrigger}
        settings={settings}
        identityPlaces={identityPlaces}
      />
      <ChatPanel
        userId={userId}
        userName={userName}
        initialHistory={initialHistory}
        onboarded={onboarded}
        onReply={() => setRefreshTrigger((t) => t + 1)}
        onLocationSeeded={addIdentityPlace}
      />
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

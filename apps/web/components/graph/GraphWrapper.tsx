"use client"

import { useState } from "react"
import GraphCanvas from "./GraphCanvas"
import ChatPanel from "@/components/chat/ChatPanel"
import type { GraphData } from "@/types/database"

interface Props {
  initialData: GraphData
  userId: string
  userName: string | null
  initialHistory?: { role: "user" | "assistant"; content: string }[]
}

export default function GraphWrapper({ initialData, userId, userName, initialHistory }: Props) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  return (
    <>
      <GraphCanvas initialData={initialData} refreshTrigger={refreshTrigger} />
      <ChatPanel userId={userId} userName={userName} initialHistory={initialHistory} onReply={() => setRefreshTrigger((t) => t + 1)} />
    </>
  )
}

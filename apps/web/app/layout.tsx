import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Hype — Your Personal Intelligence Layer",
  description: "An AI that learns who you are and what you love.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} h-full bg-[#0d0d0d] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

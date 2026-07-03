import type { Metadata, Viewport } from "next"
import { Geist, Poppins, Space_Grotesk, Inter } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-poppins",
})
// Landing page faces: Space Grotesk (tight display) + Inter (body). App keeps Geist/Poppins.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

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
      <body className={`${geist.className} ${poppins.variable} ${spaceGrotesk.variable} ${inter.variable} h-full bg-[#0d0d0d] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

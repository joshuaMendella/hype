import type { Metadata, Viewport } from "next"
import { Geist, Poppins, Space_Grotesk, Inter, Bricolage_Grotesque, Hanken_Grotesk, Space_Mono, Caveat } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-poppins",
})
// Space Grotesk + Inter: retained as the app-wide font-display/font-body default. App keeps Geist/Poppins elsewhere.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
})
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})
// Landing page redesign faces — scoped to `.landing` in globals.css (does not affect the rest
// of the app). Bricolage Grotesque = display/headlines, Hanken Grotesk = body, Space Mono = kickers.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
})
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-hanken",
})
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
})
// Handwritten annotations on the landing page (Portal-style margin notes + signature).
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-caveat",
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
      <body className={`${geist.className} ${poppins.variable} ${spaceGrotesk.variable} ${inter.variable} ${bricolage.variable} ${hanken.variable} ${spaceMono.variable} ${caveat.variable} h-full bg-[#0d0d0d] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from "next"
import { Geist, Poppins } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-poppins",
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
      <body className={`${geist.className} ${poppins.variable} h-full bg-[#0d0d0d] text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}

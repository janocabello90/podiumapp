import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" })

export const metadata: Metadata = {
  title: "SHERPA",
  description: "SHERPA · Plataforma de gestión clínica para fisioterapeutas",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

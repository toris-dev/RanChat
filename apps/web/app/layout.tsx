import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BlockChat - 블록체인 랜덤채팅",
  description: "블록체인 기반 익명 랜덤채팅 서비스",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BlockChat",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "BlockChat",
    title: "BlockChat - 블록체인 랜덤채팅",
    description: "블록체인 기반 익명 랜덤채팅 서비스",
  },
  twitter: {
    card: "summary",
    title: "BlockChat - 블록체인 랜덤채팅",
    description: "블록체인 기반 익명 랜덤채팅 서비스",
  },
}

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BlockChat" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}

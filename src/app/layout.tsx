import type { Metadata } from "next";
import { Geist, Geist_Mono, Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "تبدیل گفتار به نوشتار فارسی",
  description: "اپلیکیشن وب تبدیل گفتار به نوشتار فارسی با استفاده از هوش مصنوعی",
  keywords: ["تبدیل گفتار به نوشتار", "فارسی", "speech to text", "persian", "هوش مصنوعی"],
  authors: [{ name: "Speech to Text Team" }],
  openGraph: {
    title: "تبدیل گفتار به نوشتار فارسی",
    description: "اپلیکیشن وب تبدیل گفتار به نوشتار فارسی با استفاده از هوش مصنوعی",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "تبدیل گفتار به نوشتار فارسی",
    description: "اپلیکیشن وب تبدیل گفتار به نوشتار فارسی با استفاده از هوش مصنوعی",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "تبدیل گفتار به نوشتار",
    "mobile-web-app-capable": "yes",
    "theme-color": "#3b82f6",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${vazirmatn.variable} antialiased bg-background text-foreground font-vazirmatn`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

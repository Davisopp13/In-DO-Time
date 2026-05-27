import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import DemoBanner from "@/components/DemoBanner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeWatcher } from "@/components/ThemeWatcher";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "In DO Time",
  description: "Multi-client time tracking for DO Code Lab",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script id="init-time-aware-theme" strategy="beforeInteractive">
        {`
          (function () {
            try {
              var savedTheme = localStorage.getItem('theme');
              if (savedTheme && savedTheme !== 'system') return;

              var hour = new Date().getHours();
              var isNight = hour >= 22 || hour < 6;
              var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var shouldUseDark = isNight || prefersDark;
              var html = document.documentElement;

              html.classList.toggle('dark', shouldUseDark);
              html.style.colorScheme = shouldUseDark ? 'dark' : 'light';
            } catch (_) {}
          })();
        `}
      </Script>
      <body className={`${playfair.variable} ${inter.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeWatcher />
          <div className="min-h-screen">
            <DemoBanner />
            <Header />
            <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ShareProvider } from "@/context/share-context";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Se for uma rota do admin, não renderiza o Header e Footer do site
  const isAdmin = pathname?.toLowerCase()?.startsWith('/admin') || pathname?.toLowerCase()?.startsWith('/cms') || pathname?.startsWith('/preview/');

  if (isAdmin) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        {children}
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    );
  }

  return (
    <ShareProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        forcedTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="min-h-screen">
          {children}
        </main>

        <MobileBottomNav onMenuClick={() => setIsSidebarOpen(true)} />
        <MobileSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <Toaster position="top-right" richColors />
        <Analytics />
      </ThemeProvider>
    </ShareProvider>
  );
}

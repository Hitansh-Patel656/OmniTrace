import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "OmniTrace — Cross-Channel Customer Journey Stitching",
  description:
    "Deterministic & probabilistic identity resolution, multi-channel timeline stitching, drop-off funnel analytics, escalation tracking, and churn risk detection.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#070a10]">
      <body className="min-h-full flex bg-[#070a10] text-slate-100 antialiased font-sans">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col pl-64 min-w-0">
          <Header />
          <main className="flex-1 p-8 bg-grid-pattern bg-radial-glow overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

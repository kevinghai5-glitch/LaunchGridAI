import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LaunchGrid AI — Build AI Systems Local Businesses Will Pay Monthly For",
  description:
    "Find real local businesses, generate AI-powered Lead & Content systems, send professional proposals, and close monthly recurring clients.",
  keywords: ["AI systems", "local business", "lead generation", "content system", "proposals", "recurring revenue"],
  openGraph: {
    title: "LaunchGrid AI",
    description: "Find businesses. Generate AI systems. Send proposals. Get paid monthly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-[#0A0B0F] text-white`}>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "#0F1424",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "white",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}

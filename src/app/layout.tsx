import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
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

// Avoid FOUC: pick stored theme before paint. Default dark.
const themeInitScript = `(function(){try{var t=localStorage.getItem('lg-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${manrope.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}

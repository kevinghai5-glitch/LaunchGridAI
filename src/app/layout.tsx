import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({
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
  title: "ReclaimedHQ — Build AI Systems Local Businesses Will Pay Monthly For",
  description:
    "Find real local businesses, generate AI-powered Lead & Content systems, send professional proposals, and close monthly recurring clients.",
  keywords: ["AI systems", "local business", "lead generation", "content system", "proposals", "recurring revenue"],
  openGraph: {
    title: "ReclaimedHQ",
    description: "Find businesses. Generate AI systems. Send proposals. Get paid monthly.",
    type: "website",
  },
};

// THE ROOT LAYOUT IS SHARED WITH TWO CLIENT-FACING ROUTES.
//
//   /a/[publicId]   the cold-audit teaser a prospect opens from the pre-call email
//   /p/[publicId]   the public proposal
//
// Both are cream/serif brand documents. So the dark dashboard theme is NOT
// applied here — <html> carries no theme marker at all. It is applied in
// src/app/(dashboard)/layout.tsx via `lg-app`, which is the only fence that
// cannot be inherited by a route outside the (dashboard) group.
//
// `data-theme="dark"` used to sit on <html>. It was removed for exactly that
// reason: it is the selector tailwind.config.ts keys the `dark:` variant to, and
// on <html> that variant would have been live on a prospect's page too. Nothing
// reads it here now — globals.css applies the dark palette on :root, and the
// PAINT that palette drives is fenced behind `.lg-app`. Do not add a theme
// class, a background, or a font to <html> or <body>: put it on `.lg-app`.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}

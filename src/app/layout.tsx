import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

// The serif the CLIENT-FACING surfaces are set in — the calculator shown on a
// Zoom, the offer page, and the three deliverables. Every one of them already
// named 'Source Serif 4' in its font stack and NONE of them loaded it, so all of
// them have been rendering in the Georgia fallback. Weight 300 is here because
// the deliverable covers set their display line in it; without it the browser
// synthesises a light face and the cover reads thin and uneven.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-serif",
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
//   /p/[publicId]   the client offer, assembled from the saved calculator
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
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}

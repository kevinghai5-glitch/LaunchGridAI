import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhatWeGenerate } from "@/components/landing/WhatWeGenerate";
import { WhyItWorks } from "@/components/landing/WhyItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)", overflowX: "hidden" }}
    >
      <Nav />
      <Hero />
      <HowItWorks />
      <WhatWeGenerate />
      <WhyItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}

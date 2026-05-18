"use client";

import { motion } from "framer-motion";
import { Zap, FileText, Target } from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Lead Capture System",
    description: "A complete lead generation funnel custom-built for each business.",
    outputs: [
      "Compelling headline & sub-headline",
      "Qualification questions that filter leads",
      "Booking CTA optimized for conversion",
      "5-day follow-up email/SMS sequence",
      "Offer positioning & business strategy",
    ],
    accent: "blue",
  },
  {
    icon: Zap,
    title: "Content System",
    description: "A 30-day social content plan that builds authority and drives local traffic.",
    outputs: [
      "Core content pillars for the business",
      "30-day day-by-day posting plan",
      "Short-form hooks for Reels/TikTok",
      "Local angle ideas for community reach",
      "Hashtag strategy for each post",
    ],
    accent: "blue",
  },
  {
    icon: FileText,
    title: "Professional Proposals",
    description: "Polished proposals that close at premium prices — sent in minutes.",
    outputs: [
      "Custom package title & overview",
      "Detailed deliverables list",
      "Benefit statements that sell value",
      "Clear next steps & pricing",
      "Shareable public link + email delivery",
    ],
    accent: "green",
  },
];

export function WhatWeGenerate() {
  return (
    <section className="py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent pointer-events-none" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            What LaunchGrid Generates
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything you need to{" "}
            <span className="text-gradient">land the deal</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Three output types. Each one AI-generated with the actual business name, industry, and city — so it feels hand-crafted.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="glass-card p-8 group hover:border-blue-500/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors duration-300">
                <feature.icon className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm mb-6">{feature.description}</p>
              <ul className="space-y-2.5">
                {feature.outputs.map((output) => (
                  <li key={output} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    {output}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

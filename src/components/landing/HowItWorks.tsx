"use client";

import { motion } from "framer-motion";
import { Search, Sparkles, Send, DollarSign } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Find Real Businesses",
    description:
      "Search any industry in any city. LaunchGrid pulls real businesses from Google Places with ratings, contact info, and location data — no fake leads.",
    color: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/20",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Generate AI Systems",
    description:
      "One click generates a full Lead Capture system or 30-day Content Calendar — custom-written for each business's name, industry, and city.",
    color: "from-blue-400/20 to-blue-500/5",
    border: "border-blue-400/20",
  },
  {
    number: "03",
    icon: Send,
    title: "Send Professional Proposals",
    description:
      "Build polished proposals with pricing presets ($297, $497, $797/mo). Share a public link or email directly to the business owner.",
    color: "from-blue-300/20 to-blue-400/5",
    border: "border-blue-300/20",
  },
  {
    number: "04",
    icon: DollarSign,
    title: "Close & Track Deals",
    description:
      "Manage your pipeline in the deals Kanban. Track MRR as deals move from Saved → Won. Build a real monthly recurring business.",
    color: "from-green-400/20 to-green-500/5",
    border: "border-green-400/20",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            Simple Process
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Four steps to your first{" "}
            <span className="text-gradient">recurring client</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            LaunchGrid is built around a dead-simple offer: AI systems for local businesses, delivered monthly.
          </p>
        </motion.div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`glass-card p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300`}
            >
              {/* Gradient bg */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`}
              />
              <div className="relative">
                <div className="text-5xl font-black text-white/5 absolute -top-2 -right-1 select-none">
                  {step.number}
                </div>
                <div className={`w-10 h-10 rounded-xl bg-blue-500/10 border ${step.border} flex items-center justify-center mb-4`}>
                  <step.icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

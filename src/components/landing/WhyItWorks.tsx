"use client";

import { motion } from "framer-motion";
import { TrendingUp, Package, Zap, MapPin } from "lucide-react";

const reasons = [
  {
    icon: TrendingUp,
    title: "Recurring Revenue",
    description:
      "One client at $497/mo = $5,964/year. Stack 10 clients and you have a real $60K/year business. LaunchGrid is built for MRR, not one-time payments.",
  },
  {
    icon: Package,
    title: "Simple Offers",
    description:
      "Local businesses understand \"I'll build you a system that brings in more leads.\" No complex agency proposals — just simple, outcome-based offers.",
  },
  {
    icon: Zap,
    title: "Fast Deployment",
    description:
      "Generate a full Lead or Content system in under 60 seconds. Send a proposal in 5 minutes. Get a decision same day. Speed is your competitive edge.",
  },
  {
    icon: MapPin,
    title: "Local Businesses Need This",
    description:
      "Most local businesses have no digital systems. They spend money on ads but have no follow-up, no content, no lead capture. You solve a real problem.",
  },
];

export function WhyItWorks() {
  return (
    <section className="py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            Why It Works
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            The business model is{" "}
            <span className="text-gradient">already proven</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Agencies and freelancers charge $297–$797/month for exactly these kinds of AI systems. LaunchGrid automates the hard part.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {reasons.map((reason, i) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="panel p-6 group hover:border-blue-500/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <reason.icon className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white mb-2">{reason.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{reason.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

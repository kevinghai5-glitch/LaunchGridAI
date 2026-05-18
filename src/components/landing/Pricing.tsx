"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Zap } from "lucide-react";
import { PLANS } from "@/lib/constants";

export function Pricing() {
  return (
    <section id="pricing" className="py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            Simple Pricing
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Start free.{" "}
            <span className="text-gradient">Scale when it works.</span>
          </h2>
          <p className="text-gray-400 text-lg">
            No contracts. Cancel any time. One Pro plan, that&apos;s it.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-8"
          >
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-1">{PLANS.free.name}</h3>
              <div className="text-4xl font-bold text-white mt-2">$0</div>
              <div className="text-gray-500 text-sm">forever free</div>
            </div>
            <ul className="space-y-3 mb-8">
              {PLANS.free.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                  <Check className="h-4 w-4 text-gray-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/signup">Get started free</Link>
            </Button>
          </motion.div>

          {/* Pro — highlighted */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative glass-card p-8 border-blue-500/40 glow-blue"
          >
            {/* Pro badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-lg">
                <Zap className="h-3 w-3" />
                Most Popular
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-white mb-1">{PLANS.pro.name}</h3>
              <div className="flex items-end gap-1 mt-2">
                <span className="text-4xl font-bold text-white">${PLANS.pro.price}</span>
                <span className="text-gray-400 mb-1">/month</span>
              </div>
              <div className="text-gray-500 text-sm">billed monthly · cancel any time</div>
            </div>
            <ul className="space-y-3 mb-8">
              {PLANS.pro.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-gray-200">
                  <Check className="h-4 w-4 text-blue-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button variant="blue" className="w-full" asChild>
              <Link href="/signup">Start with Pro</Link>
            </Button>
            <p className="text-center text-xs text-gray-500 mt-3">
              One Pro client covers 6+ months of LaunchGrid
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

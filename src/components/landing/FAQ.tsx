"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Do I need any technical skills to use LaunchGrid?",
    a: "No. LaunchGrid handles all the AI generation. You just enter a business name, industry, and city, click Generate, and get a complete system. No coding, no prompting, no experience required.",
  },
  {
    q: "Do the businesses I find need to sign up for anything?",
    a: "No. You generate the systems, build the proposal, and deliver the output to the business owner. They pay you monthly for the service. LaunchGrid is your back-office tool.",
  },
  {
    q: "How do I actually get paid by the businesses?",
    a: "You handle payments directly with your clients — Stripe, PayPal, bank transfer, whatever you prefer. LaunchGrid is your lead generation and system delivery tool, not a payment processor between you and clients.",
  },
  {
    q: "What is a Lead System vs a Content System?",
    a: "A Lead System includes a headline, qualification questions, booking CTA, and a 5-day follow-up sequence. A Content System is a 30-day social media plan with hooks, captions, and hashtags. Both are custom-generated for each specific business.",
  },
  {
    q: "Can I really charge $297–$797/month for this?",
    a: "Yes. These are standard SMMA/agency rates for ongoing AI-powered systems. Most local businesses have zero digital infrastructure. A working lead capture system or content calendar that runs on autopilot is genuinely worth $300–$800/month to them.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your saved businesses, generated systems, proposals, and deals are yours. If you cancel Pro and downgrade to Free, you keep read access to existing data but creation is limited. We don't delete your data.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-32">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4">
            FAQ
          </div>
          <h2 className="text-4xl font-bold text-white">Common questions</h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-2"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="px-4 text-left hover:no-underline hover:text-blue-300 transition-colors">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="px-4">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}

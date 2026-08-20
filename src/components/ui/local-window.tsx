"use client";

// The local-time chip. ONE renderer, shared by the call queue and the
// opportunity list.
//
// It lived inside call-queue/page.tsx until the opportunity list needed it too.
// Copying it would have made a second place where "peak" gets a colour and a
// third where the legal bar gets a label — and the document list already taught
// us what a hand-written third copy costs.
//
// It renders a JUDGEMENT, not a clock: the hour is there so the operator can
// sanity-check it, but the word beside it is what the gate in call-timing.ts
// decided. "barred" is the law and "closed" is the SOP's view of answer rates;
// they are deliberately styled apart so the legal one cannot be read as a
// suggestion.

import { Clock } from "lucide-react";
import type { CityCallWindow } from "@/lib/call-timing";

export function LocalWindow({ w }: { w: CityCallWindow }) {
  if (w.window === "unknown" || w.localHour == null) return null;

  const h12 = w.localHour % 12 === 0 ? 12 : w.localHour % 12;
  const label = `${h12}${w.localHour < 12 ? "am" : "pm"} local`;

  // "barred" borrows the warning colour rather than the muted one every other
  // don't-call state uses. A row you may not legally dial should not look like a
  // row you would simply rather not dial.
  const tone =
    w.window === "peak"
      ? { color: "var(--money)", weight: 700 }
      : w.window === "barred"
        ? { color: "var(--warn)", weight: 600 }
        : w.window === "open"
          ? { color: "var(--text-3)", weight: 500 }
          : { color: "var(--text-4)", weight: 500 };

  return (
    <span
      className="flex items-center"
      style={{ gap: 3, color: tone.color, fontWeight: tone.weight }}
    >
      <Clock size={11} strokeWidth={1.9} />
      {label}
      {w.window === "peak" && " · peak"}
      {w.window === "closed" && " · closed"}
      {w.window === "barred" && " · outside legal hours"}
    </span>
  );
}

"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PROFILE_FOLLOWERS_LABEL } from "@/lib/constants";
import { monthYear } from "@/lib/format";
import { cn } from "@/lib/utils";

// Display size; a touch smaller on narrow phones so "Everyone" fits its tile.
const VALUE_CLASS = "text-[26px] leading-[34px] font-bold tabular-nums min-[400px]:text-display";

const EXPLAINER = "Everyone follows everyone here, so every profile has the same number. We rounded up.";

function StatTile({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className="glass relative flex min-h-24 flex-col items-start justify-between gap-1 rounded-lg p-4 text-left transition-transform duration-150 outline-none hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {children}
        <span className="text-meta text-muted-foreground">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-ui">{EXPLAINER}</PopoverContent>
    </Popover>
  );
}

/**
 * The profile's signature gimmick (Q31): two tiles, identical on every profile. The only data
 * used is the join date; "1bn+" is the frontend constant PROFILE_FOLLOWERS_LABEL.
 */
export function EveryoneStat({ createdAt }: { createdAt: string }) {
  const since = `following since ${monthYear(createdAt)}`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile
        label="followers"
        ariaLabel={`${PROFILE_FOLLOWERS_LABEL} followers, the same as everyone. What does this mean?`}
      >
        <span className={VALUE_CLASS}>{PROFILE_FOLLOWERS_LABEL}</span>
      </StatTile>
      <StatTile label={since} ariaLabel={`Everyone, ${since}. What does this mean?`}>
        <span className={VALUE_CLASS}>Everyone</span>
        <Sparkles aria-hidden="true" className="absolute top-3 right-3 size-5 text-accent-foreground" />
      </StatTile>
    </div>
  );
}

const BUBBLE_TINTS = [
  ["#8fd8ff", "#0b5fa8"],
  ["#b8ee8f", "#2e9b3e"],
  ["#ffe08a", "#c98500"],
  ["#d3c6ff", "#5536b0"],
  ["#9eeee0", "#00796b"],
  ["#ffc6ad", "#c2410c"],
  ["#c7ecff", "#1683cf"],
  ["#d6f7c8", "#4db848"],
];

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Seven overlapping avatar bubbles, re-shuffled on every visit. Decorative. */
export function EveryoneBubbles({ className }: { className?: string }) {
  const [tints] = useState(() => shuffled(BUBBLE_TINTS).slice(0, 7));
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3", className)}>
      <div className="flex -space-x-2.5">
        {tints.map(([from, to], i) => (
          <span
            key={i}
            className="marble inline-block size-7"
            style={{
              background: `radial-gradient(circle at 35% 25%, rgb(255 255 255 / 0.75) 0 10%, transparent 42%), linear-gradient(160deg, ${from}, ${to})`,
            }}
          />
        ))}
      </div>
      <span className="text-meta text-muted-foreground">and everyone else</span>
    </div>
  );
}

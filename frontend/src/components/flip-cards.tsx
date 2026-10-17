"use client";

import { useState } from "react";
import { Flame, Heart, type LucideIcon, Sparkles, ThumbsDown, UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Side {
  icon: LucideIcon;
  title: string;
  text: string;
}

const FLIPS: { usual: Side; flipped: Side }[] = [
  {
    usual: { icon: UserPlus, title: "Follow", text: "Start with no one. Build your bubble one follow at a time." },
    flipped: {
      icon: UserMinus,
      title: "Unfollow",
      text: "Start following everyone. A bubble now takes real effort.",
    },
  },
  {
    usual: { icon: Heart, title: "Like", text: "Every like teaches the feed more of the same." },
    flipped: {
      icon: ThumbsDown,
      title: "Dislike + reason",
      text: "Push back. The feed never learns your taste from it.",
    },
  },
  {
    usual: {
      icon: Flame,
      title: "Engagement feed",
      text: "Popular gets shown, so it gets more popular. Forever.",
    },
    flipped: {
      icon: Sparkles,
      title: "Fair attention",
      text: "Unseen voices get a fair share, every post says why, and it ends.",
    },
  },
];

function Face({ side, flipped }: { side: Side; flipped: boolean }) {
  const Icon = side.icon;
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col gap-2 rounded-lg p-4 text-left [backface-visibility:hidden]",
        flipped ? "glass [transform:rotateY(180deg)]" : "border border-input/30 bg-[#eef1f4]",
      )}
    >
      <span className="text-meta font-semibold tracking-wide text-muted-foreground uppercase">
        {flipped ? "Serendipity" : "Usual social media"}
      </span>
      <span className="flex items-center gap-2 text-heading font-semibold">
        <Icon aria-hidden className={cn("size-5", flipped ? "text-primary" : "text-muted-foreground")} />
        {side.title}
      </span>
      <span className="text-ui">{side.text}</span>
    </div>
  );
}

/** "Flip the script": each card turns over from usual social media to Serendipity. */
export function FlipCards() {
  const [flipped, setFlipped] = useState<boolean[]>(FLIPS.map(() => false));
  const allFlipped = flipped.every(Boolean);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {FLIPS.map((flip, i) => (
          <button
            key={flip.usual.title}
            type="button"
            aria-pressed={flipped[i]}
            aria-label={
              flipped[i]
                ? `${flip.flipped.title}: ${flip.flipped.text} Show usual social media.`
                : `${flip.usual.title}: ${flip.usual.text} Flip to Serendipity.`
            }
            onClick={() => setFlipped((f) => f.map((v, j) => (j === i ? !v : v)))}
            className="group h-48 rounded-lg [perspective:900px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              className={cn(
                "relative block size-full transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none",
                flipped[i] && "[transform:rotateY(180deg)]",
              )}
            >
              <Face side={flip.usual} flipped={false} />
              <Face side={flip.flipped} flipped />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button variant="gel" size="sm" onClick={() => setFlipped(FLIPS.map(() => !allFlipped))}>
          {allFlipped ? "Flip back" : "Flip the script"}
        </Button>
        <span className="text-meta text-muted-foreground">Or tap a card.</span>
      </div>
    </>
  );
}

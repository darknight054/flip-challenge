"use client";

import Link from "next/link";
import {
  Compass,
  Megaphone,
  MessagesSquare,
  Scale,
  Shuffle,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { REASONS } from "@/lib/constants";
import type { ReasonCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export const REASON_ICONS: Record<ReasonCode, LucideIcon> = {
  fresh: Sprout,
  underexposed: Megaphone,
  discussion: MessagesSquare,
  wildcard: Shuffle,
  outside_your_usual: Compass,
  contested: Scale,
};

const pillClass =
  "gloss-pill inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-meta font-semibold";

/** Static pill (icon + word), used where no explanation popover is needed. */
export function ReasonPill({ code, className }: { code: ReasonCode; className?: string }) {
  const Icon = REASON_ICONS[code];
  return (
    <span className={cn(pillClass, REASONS[code].badge, className)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {REASONS[code].label}
    </span>
  );
}

/** The first line of every feed post: why it's here. A Popover (not a Tooltip) for touch. */
export function FeedReasonBadge({ code }: { code: ReasonCode }) {
  const reason = REASONS[code];
  const Icon = REASON_ICONS[code];
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Why you're seeing this: ${reason.label}`}
        className={cn(
          pillClass,
          reason.badge,
          "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {reason.label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-ui">
        <p>{reason.text}</p>
        <Link href="/algorithm" className="font-semibold text-primary underline-offset-4 hover:underline">
          How Serendipity works
        </Link>
      </PopoverContent>
    </Popover>
  );
}

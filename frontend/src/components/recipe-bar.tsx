import { REASONS } from "@/lib/constants";
import { percent } from "@/lib/format";
import type { Pool } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Glossy segmented bar of today's feed recipe. Decorative: the rows beside it carry the data. */
export function RecipeBar({ pools, className }: { pools: Pool[]; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-white/70 p-0.5 shadow-[inset_0_1px_2px_rgb(14_42_71/0.2)]",
        className,
      )}
    >
      {pools.map((pool) => (
        <span
          key={pool.code}
          className={cn("gloss-pill h-full rounded-full", REASONS[pool.code].segment)}
          style={{ width: percent(pool.share) }}
        />
      ))}
    </div>
  );
}

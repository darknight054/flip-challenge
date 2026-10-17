import { cn } from "@/lib/utils";

/** Outline gloss-pill "demo" marker after the name of every seed account. Non-interactive. */
export function SyntheticBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "gloss-pill inline-flex h-5 shrink-0 items-center rounded-full border border-input/50 bg-white/70 px-2 text-[12px] leading-none font-semibold text-muted-foreground",
        className,
      )}
    >
      demo<span className="sr-only"> account</span>
    </span>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/** 24px glass orb: a radial-gradient sphere with a white specular highlight. */
export function GlassOrb({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block size-6 shrink-0 rounded-full", className)}
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #ffffff 0 12%, #9be0ff 28%, #1683cf 62%, #0b5fa8 100%)",
        boxShadow: "inset 0 -2px 4px rgb(14 42 71 / 0.35), 0 1px 3px rgb(14 42 71 / 0.3)",
      }}
    />
  );
}

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md text-title font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
    >
      <GlassOrb />
      <span className="wordmark">Serendipity</span>
    </Link>
  );
}

import { cn } from "@/lib/utils";

const TONES = {
  green: "radial-gradient(circle at 35% 28%, #ffffff 0 10%, #bff2a6 26%, #4db848 62%, #1f7a2e 100%)",
  blue: "radial-gradient(circle at 35% 28%, #ffffff 0 10%, #9be0ff 26%, #1683cf 62%, #0b5fa8 100%)",
};

/** A glass orb (sphere + specular highlight) holding a white icon. Decorative. */
export function Orb({
  tone = "green",
  size = 56,
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-white", className)}
      style={{
        width: size,
        height: size,
        background: TONES[tone],
        boxShadow:
          "inset 0 -3px 6px rgb(14 42 71 / 0.3), inset 0 2px 2px rgb(255 255 255 / 0.6), 0 6px 16px -6px rgb(14 42 71 / 0.45)",
      }}
    >
      {children}
    </span>
  );
}

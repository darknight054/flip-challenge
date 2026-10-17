import type { CSSProperties } from "react";

// 5-7 out-of-focus bubbles, positioned asymmetrically. Each drifts on its own 40-60 s loop.
const BUBBLES = [
  { size: 180, left: "4%", top: "12%", duration: "56s", dx: "50px", dy: "-70px" },
  { size: 64, left: "24%", top: "64%", duration: "44s", dx: "-30px", dy: "-50px" },
  { size: 120, left: "81%", top: "9%", duration: "60s", dx: "-60px", dy: "40px" },
  { size: 40, left: "90%", top: "52%", duration: "40s", dx: "-20px", dy: "-60px" },
  { size: 96, left: "62%", top: "71%", duration: "52s", dx: "40px", dy: "-40px" },
  { size: 52, left: "41%", top: "22%", duration: "48s", dx: "30px", dy: "50px" },
];

/** The Frutiger Aero sky, hill and bubbles: one fixed, decorative layer behind everything. */
export function AeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--sky-top), var(--sky-mid) 45%, var(--sky-low) 75%)",
      }}
    >
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="absolute block animate-drift rounded-full motion-reduce:animate-none"
          style={
            {
              width: b.size,
              height: b.size,
              left: b.left,
              top: b.top,
              animationDuration: b.duration,
              "--drift-x": b.dx,
              "--drift-y": b.dy,
              background:
                "radial-gradient(circle, rgb(255 255 255 / 0) 58%, rgb(255 255 255 / 0.6) 100%)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.35)",
            } as CSSProperties
          }
        >
          <span
            className="absolute block rounded-full"
            style={{
              left: "18%",
              top: "14%",
              width: "22%",
              height: "14%",
              transform: "rotate(-35deg)",
              background: "radial-gradient(closest-side, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0))",
            }}
          />
        </span>
      ))}

      <svg
        className="absolute inset-x-0 bottom-0 h-[22vh] w-full"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="aero-hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hill-top)" />
            <stop offset="100%" stopColor="var(--hill-low)" />
          </linearGradient>
          <linearGradient id="aero-hill-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--hill-top)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--hill-low)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path
          d="M0 120 C 240 40, 520 70, 760 92 S 1220 30, 1440 70 L1440 220 L0 220 Z"
          fill="url(#aero-hill-back)"
        />
        <path d="M0 150 C 300 70, 640 110, 900 120 S 1300 90, 1440 110 L1440 220 L0 220 Z" fill="url(#aero-hill)" />
        <path
          d="M0 150 C 300 70, 640 110, 900 120 S 1300 90, 1440 110"
          fill="none"
          stroke="white"
          strokeOpacity="0.75"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

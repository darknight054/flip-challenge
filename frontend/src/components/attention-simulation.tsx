"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/explainer-parts";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import type { Simulation } from "@/lib/types";
import { cn } from "@/lib/utils";

// Categorical pair validated with the dataviz palette checker against the glass surface (#F7FCFF).
const ENGAGEMENT_COLOR = "#D9622B";
const SERENDIPITY_COLOR = "#1673C2";
const STEP_MS = 140;
const COLS = 10;
const CELL = 36;
const MAX_R = CELL / 2 - 2;
const EMPTY_R = 3;

interface Track {
  key: string;
  label: string;
  demoOnly: boolean;
  color: string;
  /** cumulative[step][creatorIndex]: times each creator was shown after `step` viewers */
  cumulative: number[][];
}

function gini(values: number[]): number {
  const xs = [...values].sort((a, b) => a - b);
  const total = xs.reduce((sum, x) => sum + x, 0);
  if (xs.length === 0 || total === 0) return 0;
  const weighted = xs.reduce((sum, x, i) => sum + (i + 1) * x, 0);
  return (2 * weighted) / (xs.length * total) - (xs.length + 1) / xs.length;
}

function buildTracks(sim: Simulation): Track[] {
  const index = new Map(sim.creators.map((creator, i) => [creator.id, i]));
  return sim.rankers.map((ranker) => {
    const counts = sim.creators.map(() => 0);
    const cumulative = [[...counts]];
    for (const slate of ranker.slates) {
      for (const authorId of slate) {
        const i = index.get(authorId);
        if (i !== undefined) counts[i] += 1;
      }
      cumulative.push([...counts]);
    }
    return {
      key: ranker.key,
      label: ranker.label,
      demoOnly: ranker.demo_only,
      color: ranker.demo_only ? ENGAGEMENT_COLOR : SERENDIPITY_COLOR,
      cumulative,
    };
  });
}

function metrics(counts: number[]) {
  const total = counts.reduce((sum, n) => sum + n, 0);
  const top5 = [...counts]
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((sum, n) => sum + n, 0);
  return {
    gap: gini(counts),
    reached: counts.filter((n) => n > 0).length,
    top5Share: total ? top5 / total : 0,
    total,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col justify-between rounded-md bg-white/60 px-2 py-1.5">
      <dt className="text-meta leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-heading font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  track,
  step,
  creators,
  maxCount,
}: {
  track: Track;
  step: number;
  creators: Simulation["creators"];
  maxCount: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const counts = track.cumulative[step];
  const m = metrics(counts);
  const rows = Math.ceil(creators.length / COLS);
  const focus = hovered === null ? null : { creator: creators[hovered], shown: counts[hovered] };

  return (
    <div
      className={cn(
        "rounded-lg p-3",
        track.demoOnly ? "border border-input/30 bg-[#f3f1ef]" : "glass",
      )}
    >
      <h3 className="flex items-center gap-2 text-heading font-semibold">
        <span aria-hidden className="size-3 rounded-full" style={{ background: track.color }} />
        {track.label}
      </h3>
      <svg
        viewBox={`0 0 ${COLS * CELL} ${rows * CELL}`}
        className="mt-2 h-auto w-full"
        role="img"
        aria-label={`${track.label}: after ${step} viewers, ${m.reached} of ${creators.length} creators have been shown. Attention gap ${m.gap.toFixed(2)}.`}
      >
        {creators.map((creator, i) => {
          const shown = counts[i];
          const cx = (i % COLS) * CELL + CELL / 2;
          const cy = Math.floor(i / COLS) * CELL + CELL / 2;
          const r = shown ? Math.max(EMPTY_R + 1, MAX_R * Math.sqrt(shown / maxCount)) : EMPTY_R;
          return (
            <g key={creator.id} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <rect x={cx - CELL / 2} y={cy - CELL / 2} width={CELL} height={CELL} fill="transparent" />
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={shown ? track.color : "none"}
                fillOpacity={0.88}
                stroke={shown ? "#ffffff" : "var(--input)"}
                strokeWidth={shown ? 2 : 1.25}
                className="transition-[r] duration-150 ease-out motion-reduce:transition-none"
              >
                <title>{`@${creator.username}: shown ${shown} times`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 min-h-[18px] text-meta text-muted-foreground" aria-hidden>
        {focus
          ? `@${focus.creator.username}: shown ${focus.shown} ${focus.shown === 1 ? "time" : "times"}${
              m.total ? ` (${Math.round((focus.shown / m.total) * 100)}% of slots so far)` : ""
            }`
          : "Hover a bubble to see a creator."}
      </p>
      <dl className="mt-2 grid grid-cols-3 gap-2">
        <Stat label="Attention gap" value={m.gap.toFixed(2)} />
        <Stat label="Creators shown" value={`${m.reached}/${creators.length}`} />
        <Stat label="Top 5 got" value={`${Math.round(m.top5Share * 100)}%`} />
      </dl>
    </div>
  );
}

/** 50 simulated people open their feed one after another; watch who gets the attention (Q22). */
export function AttentionSimulation() {
  const sim = useQuery({ queryKey: qk.simulation, queryFn: api.simulation, staleTime: 10 * 60_000 });
  const tracks = useMemo(() => (sim.data ? buildTracks(sim.data) : []), [sim.data]);
  const viewers = sim.data?.viewers ?? 0;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const running = playing && step < viewers;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => Math.min(s + 1, viewers)), STEP_MS);
    return () => window.clearInterval(id);
  }, [running, viewers]);

  if (sim.isPending) return <Skeleton className="h-96 w-full" />;
  if (sim.isError) return <LoadError onRetry={() => sim.refetch()} />;

  const maxCount = Math.max(1, ...tracks.flatMap((t) => t.cumulative[viewers]));
  const finals = tracks.map((t) => ({ label: t.label, ...metrics(t.cumulative[viewers]) }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="gel"
          size="sm"
          onClick={() => {
            if (step >= viewers) setStep(0);
            setPlaying(!running);
          }}
        >
          {running ? <Pause aria-hidden /> : <Play aria-hidden />}
          {running ? "Pause" : step >= viewers ? "Play again" : "Play"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          <RotateCcw aria-hidden />
          Reset
        </Button>
        <label className="flex min-w-48 flex-1 items-center gap-3 text-meta text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            Viewers: <span className="font-semibold text-foreground">{step}</span>/{viewers}
          </span>
          <input
            type="range"
            min={0}
            max={viewers}
            value={step}
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }}
            className="w-full accent-primary"
            aria-label="Number of simulated viewers"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <Field key={track.key} track={track} step={step} creators={sim.data.creators} maxCount={maxCount} />
        ))}
      </div>

      <p className="mt-3 text-meta text-muted-foreground">
        Each bubble is one of the {sim.data.creators.length} creators; its size shows how often their posts were
        shown. Both feeds serve the same posts to the same {viewers} simulated people, one after another, and
        whatever gets shown counts as seen before the next person arrives. Attention gap runs from 0 (everyone
        shown equally) to 1 (one creator gets everything). The engagement-style feed is a simulation for
        comparison; it&apos;s never a feed option.
      </p>
      <p className="sr-only">
        After all {viewers} viewers:{" "}
        {finals
          .map((f) => `${f.label} showed ${f.reached} creators, attention gap ${f.gap.toFixed(2)}`)
          .join("; ")}
        .
      </p>
    </>
  );
}

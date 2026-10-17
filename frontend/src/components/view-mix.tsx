"use client";

import { useQuery } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/explainer-parts";
import { useRecipe } from "@/hooks/queries";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";

const BAR_COLOR = "#1673C2"; // single series: one hue (dataviz), same blue as Serendipity in the simulation

/** The viewer's own views by topic: the only personal input seen-least-v1 uses (Q18). */
export function ViewMixChart() {
  const mix = useQuery({ queryKey: qk.viewMix, queryFn: api.viewMix, staleTime: 30_000 });
  const recipe = useRecipe();
  if (mix.isPending) return <Skeleton className="h-64 w-full" />;
  if (mix.isError) return <LoadError onRetry={() => mix.refetch()} />;

  const { topics, total_views: total, min_views: minViews, window_days: days } = mix.data;
  const enough = total >= minViews;
  const personal = recipe.data?.pools.some((pool) => pool.code === "outside_your_usual") ?? false;
  const max = Math.max(1, ...topics.map((t) => t.views));
  // The least-seen topics (ties included) are where "Outside your usual" looks first.
  const threshold = [...topics.map((t) => t.views)].sort((a, b) => a - b)[2] ?? 0;

  return (
    <>
      <p className="text-ui">
        <span className="font-semibold tabular-nums">{total}</span> posts seen in the last {days} days.{" "}
        {enough ? null : (
          <span className="text-muted-foreground">
            Outside your usual switches on after {minViews}. Scroll the feed, then come back.
          </span>
        )}
      </p>
      <ul className="mt-3 space-y-1.5" aria-label="Your views by topic">
        {topics.map((topic) => {
          const least = enough && topic.views <= threshold && topic.views < max;
          return (
            <li
              key={topic.slug}
              className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-x-3"
              title={`${topic.label}: ${topic.views} ${topic.views === 1 ? "view" : "views"}`}
            >
              <span className="flex items-center gap-1 truncate text-meta">
                {topic.label}
                {least ? <Compass aria-label="least seen" className="size-3.5 shrink-0 text-reason-outside" /> : null}
              </span>
              <span className="relative h-3 rounded-[4px] bg-muted">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${(topic.views / max) * 100}%`, background: BAR_COLOR }}
                />
              </span>
              <span className="text-right text-meta text-muted-foreground tabular-nums">{topic.views}</span>
            </li>
          );
        })}
      </ul>
      {enough ? (
        <p className="mt-3 flex items-center gap-1.5 text-meta text-muted-foreground">
          <Compass aria-hidden className="size-3.5 text-reason-outside" />
          Your least-seen topics: where {personal ? "Outside your usual looks" : "seen-least-v1 would look"} first.
        </p>
      ) : null}
    </>
  );
}

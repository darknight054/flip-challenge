"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/glass-panel";
import { ReasonPill } from "@/components/feed-reason-badge";
import { RecipeBar } from "@/components/recipe-bar";
import { useRecipe } from "@/hooks/queries";
import { useHydrated } from "@/hooks/use-hydrated";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import { TOPIC_COUNT, topicLabel } from "@/lib/constants";
import { percent } from "@/lib/format";
import type { Ranker } from "@/lib/types";
import { cn } from "@/lib/utils";

const SLOTS_SHOWN = 10;

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="border-t border-divider px-4 py-5 lg:px-5">
      <h2 id={id} className="text-heading font-semibold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-ui text-muted-foreground">Couldn&apos;t load this.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function Pools() {
  const recipe = useRecipe();
  // The shell's right panel may have loaded the recipe before this page hydrates.
  const hydrated = useHydrated();
  if (!hydrated || recipe.isPending) return <Skeleton className="h-28 w-full" />;
  if (recipe.isError) return <LoadError onRetry={() => recipe.refetch()} />;
  const personal = recipe.data.pools.some((pool) => pool.code === "outside_your_usual");
  return (
    <>
      <p className="mb-3 text-ui text-muted-foreground">
        {recipe.data.pools.length} pools, mixed on every page.{" "}
        <span className="gloss-pill inline-flex h-5 items-center rounded-full bg-white/70 px-2 text-meta font-semibold text-foreground">
          {recipe.data.active_version}
        </span>
      </p>
      <RecipeBar pools={recipe.data.pools} />
      <ul className="mt-4 space-y-3">
        {recipe.data.pools.map((pool) => (
          <li key={pool.code} className="grid grid-cols-[auto_3rem_1fr] items-center gap-x-3 gap-y-1">
            <ReasonPill code={pool.code} />
            <span className="text-ui font-semibold tabular-nums">{percent(pool.share)}</span>
            <span className="text-ui text-muted-foreground">{pool.description}</span>
          </li>
        ))}
      </ul>
      {personal ? (
        <p className="mt-4 text-ui">
          The only thing about you it uses is what you&apos;ve already seen in the last week, and only to show you
          something different. Never what you disliked or who you unfollowed.
        </p>
      ) : null}
    </>
  );
}

function RankerCard({ ranker, className }: { ranker: Ranker; className?: string }) {
  // The engagement ranker is flat and greyed; Serendipity gets full Aero gloss.
  const flat = ranker.demo_only;
  return (
    <div
      className={cn(
        "rounded-lg p-4",
        flat ? "border border-input/25 bg-[#eef2f5] text-foreground/80 saturate-50" : "glass",
        className,
      )}
    >
      <h3 className="flex items-center gap-2 text-heading font-semibold">{ranker.label}</h3>
      <ol className="mt-3 space-y-1">
        {ranker.slots.slice(0, SLOTS_SHOWN).map((slot) => (
          <li key={slot.position} className="flex items-center justify-between gap-3 text-meta">
            <span className="truncate font-semibold">@{slot.author.username}</span>
            <span className="shrink-0 text-muted-foreground">{topicLabel(slot.topic)}</span>
          </li>
        ))}
      </ol>
      <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-divider pt-3 text-ui">
        <dt>Attention gap</dt>
        <dd className="text-right font-bold tabular-nums">{ranker.metrics.attention_gap.toFixed(2)}</dd>
        <dt>Topics covered</dt>
        <dd className="text-right font-bold tabular-nums">
          {ranker.metrics.topics_covered}/{TOPIC_COUNT}
        </dd>
      </dl>
    </div>
  );
}

function Comparison() {
  const comparison = useQuery({ queryKey: qk.comparison, queryFn: api.comparison, staleTime: 10 * 60_000 });
  const title = comparison.data
    ? `Same ${comparison.data.dataset.posts} posts, ranked two ways`
    : "Same posts, ranked two ways";

  return (
    <Section id="comparison" title={title}>
      {comparison.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : comparison.isError ? (
        <LoadError onRetry={() => comparison.refetch()} />
      ) : (
        <>
          <div className="hidden grid-cols-2 gap-4 md:grid">
            {comparison.data.rankers.map((ranker) => (
              <RankerCard key={ranker.key} ranker={ranker} />
            ))}
          </div>
          <Tabs defaultValue={comparison.data.rankers.at(-1)?.key} className="md:hidden">
            <TabsList className="w-full rounded-full bg-white/70 p-1 group-data-horizontal/tabs:h-11">
              {comparison.data.rankers.map((ranker) => (
                <TabsTrigger key={ranker.key} value={ranker.key} className="rounded-full text-ui">
                  {ranker.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {comparison.data.rankers.map((ranker) => (
              <TabsContent key={ranker.key} value={ranker.key}>
                <RankerCard ranker={ranker} />
              </TabsContent>
            ))}
          </Tabs>
          <p className="mt-4 text-meta text-muted-foreground">
            The engagement-style ranking is a simulation for comparison. It&apos;s never a feed option. Attention gap measures how
            unevenly attention is spread across creators: lower is more even.
          </p>
        </>
      )}
    </Section>
  );
}

function NeverUsed() {
  const recipe = useRecipe();
  const hydrated = useHydrated();
  return (
    <Section id="never-used" title="Never used">
      {hydrated && recipe.data ? (
        <ul className="list-disc space-y-1 pl-5 text-ui">
          {recipe.data.never_used.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-ui">Disagreeing never lowers a post&apos;s reach.</p>
    </Section>
  );
}

/** "How it works": plain language first, the comparison backs it up (Q22). */
export function AlgorithmExplainer() {
  return (
    <GlassPanel aria-labelledby="algorithm-title">
      <header className="px-4 py-5 lg:px-5">
        <h1 id="algorithm-title" className="text-title font-bold">
          How Serendipity works
        </h1>
        <p className="mt-2 text-post">
          Everyone starts following everyone. You decide what disappears. The feed gives unfamiliar voices a fair
          chance, then it ends.
        </p>
      </header>
      <Section id="pools" title="How each feed is built">
        <Pools />
      </Section>
      <Comparison />
      <NeverUsed />
    </GlassPanel>
  );
}

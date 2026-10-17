"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AttentionSimulation } from "@/components/attention-simulation";
import { LoadError, Section } from "@/components/explainer-parts";
import { FlipCards } from "@/components/flip-cards";
import { GlassPanel } from "@/components/glass-panel";
import { ReasonPill } from "@/components/feed-reason-badge";
import { PoolExplorer } from "@/components/pool-explorer";
import { RecipeBar } from "@/components/recipe-bar";
import { ViewMixChart } from "@/components/view-mix";
import { useRecipe } from "@/hooks/queries";
import { useHydrated } from "@/hooks/use-hydrated";
import { percent } from "@/lib/format";

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

/** "How it works": an interactive walk through the idea, in pitch order (Q22). */
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
      <Section id="flip" title="Flip the script" intro="Three things we turned upside down.">
        <FlipCards />
      </Section>
      <Section
        id="attention"
        title="Watch attention spread"
        intro="50 people open their feed, one after another. Press play and watch who gets seen."
      >
        <AttentionSimulation />
      </Section>
      <Section id="pools" title="How each feed is built">
        <Pools />
      </Section>
      <Section
        id="pool-explorer"
        title="See what each pool picks for you"
        intro="Real posts from your feed right now. Looking here doesn't use them up."
      >
        <PoolExplorer />
      </Section>
      <Section
        id="view-mix"
        title="What you've been seeing"
        intro="Your own views this week: the only personal thing Serendipity uses."
      >
        <ViewMixChart />
      </Section>
      <NeverUsed />
    </GlassPanel>
  );
}

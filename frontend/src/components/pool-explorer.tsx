"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadError } from "@/components/explainer-parts";
import { ReasonPill } from "@/components/feed-reason-badge";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import { REASONS, topicLabel } from "@/lib/constants";
import { percent } from "@/lib/format";
import type { ReasonCode } from "@/lib/types";

const EMPTY: Partial<Record<ReasonCode, string>> = {
  discussion: "Empty for now: it needs posts with replies from 3 or more different people.",
  outside_your_usual: "Switches on once you've seen a few posts this week. Scroll the feed, then come back.",
};

/** Real posts each pool would pick for the viewer right now. Read-only: nothing is used up. */
export function PoolExplorer() {
  const pools = useQuery({ queryKey: qk.pools, queryFn: api.pools, staleTime: 60_000 });
  if (pools.isPending) return <Skeleton className="h-56 w-full" />;
  if (pools.isError) return <LoadError onRetry={() => pools.refetch()} />;
  const list = pools.data.pools;

  return (
    <Tabs defaultValue={list[0]?.code}>
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-white/70 p-1">
        {list.map((pool) => (
          <TabsTrigger key={pool.code} value={pool.code} className="h-auto flex-none rounded-full px-1 py-1">
            <ReasonPill code={pool.code} />
          </TabsTrigger>
        ))}
      </TabsList>
      {list.map((pool) => (
        <TabsContent key={pool.code} value={pool.code} className="mt-3">
          <p className="text-ui">
            <span className="font-semibold">{percent(pool.share)} of every page.</span> {REASONS[pool.code].text}
          </p>
          {pool.posts.length ? (
            <ul className="mt-3 space-y-2">
              {pool.posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/p/${post.id}`}
                    className="flex gap-3 rounded-lg bg-white/60 p-3 transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <UserAvatar user={post.author} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate text-meta text-muted-foreground">
                        <span className="font-semibold text-foreground">{post.author.display_name}</span> @
                        {post.author.username} · {topicLabel(post.topic)}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-ui">{post.body}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ui text-muted-foreground">
              {EMPTY[pool.code] ?? "Nothing in this pool for you right now."}
            </p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

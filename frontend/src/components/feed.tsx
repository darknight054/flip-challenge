"use client";

import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CircleAlert, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CaughtUpState } from "@/components/caught-up-state";
import { useComposer } from "@/components/composer-provider";
import { GlassPanel } from "@/components/glass-panel";
import { FeedSkeleton, PostCard } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { usePinnedPosts } from "@/hooks/queries";
import { useImpressions, type ObserveImpression } from "@/hooks/use-impressions";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import { FEED_PAGE_SIZE } from "@/lib/constants";
import type { FeedItem } from "@/lib/types";

interface FeedRowProps {
  item: FeedItem;
  sessionId: string;
  position: number;
  observe: ObserveImpression;
}

function FeedRow({ item, sessionId, position, observe }: FeedRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const postId = item.post.id;

  useEffect(() => {
    if (!ref.current) return;
    return observe(ref.current, { sessionId, postId, position });
  }, [observe, sessionId, postId, position]);

  return (
    <div ref={ref}>
      <PostCard post={item.post} variant="feed" reason={item.reason_code} />
    </div>
  );
}

function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="p-4 lg:p-5">
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertDescription className="text-destructive">
          Couldn&apos;t load your feed. Check your connection and try again.
        </AlertDescription>
      </Alert>
      <div className="mt-3 flex justify-center">
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Home feed: pages of 20, a "Show more posts" button (no infinite scroll), and a designed end.
 * The feed session never refetches on its own: a cursor-less request starts a new session.
 */
export function Feed() {
  const { registerInline } = useComposer();
  const observe = useImpressions();
  const pinned = usePinnedPosts();
  const feed = useInfiniteQuery({
    queryKey: qk.feed,
    queryFn: ({ pageParam }) => api.feed(pageParam, FEED_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.end_of_feed ? null : last.next_cursor),
    staleTime: Infinity,
    refetchOnReconnect: false,
  });

  const rows = (feed.data?.pages ?? []).flatMap((page) =>
    page.items.map((item) => ({ item, sessionId: page.session_id })),
  );
  const endOfFeed = feed.data?.pages.at(-1)?.end_of_feed ?? false;

  return (
    <GlassPanel aria-labelledby="feed-title">
      <h1 id="feed-title" className="sr-only">
        Feed
      </h1>
      <div className="hidden border-b border-divider lg:block">
        <PostComposer registerFocus={registerInline} />
      </div>

      <div className="divide-y divide-divider">
        {pinned.map((post) => (
          <div key={`pinned-${post.id}`}>
            <PostCard post={post} variant="pinned" />
          </div>
        ))}
        {rows.map(({ item, sessionId }, position) => (
          <FeedRow key={item.post.id} item={item} sessionId={sessionId} position={position} observe={observe} />
        ))}
      </div>

      <div className={rows.length > 0 || pinned.length > 0 ? "border-t border-divider" : undefined}>
        {feed.isPending ? (
          <FeedSkeleton />
        ) : feed.isError && !feed.data ? (
          <FeedError onRetry={() => feed.refetch()} />
        ) : feed.isFetchNextPageError ? (
          <FeedError onRetry={() => feed.fetchNextPage()} />
        ) : endOfFeed ? (
          <CaughtUpState posts={rows.map((r) => r.item.post)} />
        ) : feed.hasNextPage ? (
          <div className="flex justify-center px-4 py-6">
            <Button
              variant="gel"
              onClick={() => feed.fetchNextPage()}
              disabled={feed.isFetchingNextPage}
              aria-busy={feed.isFetchingNextPage}
            >
              {feed.isFetchingNextPage ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Show more posts
            </Button>
          </div>
        ) : null}
      </div>
    </GlassPanel>
  );
}

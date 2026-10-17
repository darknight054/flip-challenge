"use client";

import { use } from "react";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { BackButton, GlassPanel } from "@/components/glass-panel";
import { CommentForm, CommentList } from "@/components/comment-thread";
import { FeedSkeleton, PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { api, isApiError } from "@/lib/api";
import { qk } from "@/lib/cache";
import type { FeedPage, Post, PostPage } from "@/lib/types";

const COMMENT_BOX_ID = "comment-box";

/** Show a post we already have (feed, profile) while its own request is in flight. */
function useCachedPost(id: number): () => Post | undefined {
  const qc = useQueryClient();
  return () => {
    for (const [, data] of qc.getQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feed })) {
      const hit = data?.pages.flatMap((p) => p.items).find((i) => i.post.id === id);
      if (hit) return hit.post;
    }
    for (const [, data] of qc.getQueriesData<InfiniteData<PostPage>>({ queryKey: qk.allUserPosts })) {
      const hit = data?.pages.flatMap((p) => p.items).find((p) => p.id === id);
      if (hit) return hit;
    }
    return qc.getQueryData<Post[]>(qk.pinned)?.find((p) => p.id === id);
  };
}

export function PostDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = Number(rawId);
  const valid = Number.isInteger(id) && id > 0;
  const cached = useCachedPost(id);
  const post = useQuery({
    queryKey: qk.post(id),
    queryFn: () => api.post(id),
    enabled: valid,
    placeholderData: cached,
  });

  const removed = !valid || isApiError(post.error, "not_found");

  return (
    <GlassPanel aria-labelledby="post-title">
      <div className="border-b border-divider px-4 py-2 lg:px-5">
        <BackButton />
      </div>
      <h1 id="post-title" className="sr-only">
        Post
      </h1>

      {removed ? (
        <p className="px-4 py-10 text-center text-ui text-muted-foreground lg:px-5">This post was removed.</p>
      ) : post.data ? (
        <>
          <PostCard
            post={post.data}
            variant="detail"
            onReply={() => document.getElementById(COMMENT_BOX_ID)?.focus()}
          />
          <div id="comments" className="border-y border-divider px-4 py-4 lg:px-5">
            <CommentForm postId={id} textareaId={COMMENT_BOX_ID} />
          </div>
          <CommentList postId={id} />
        </>
      ) : post.isError ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-ui text-muted-foreground">Couldn&apos;t load this post.</p>
          <Button variant="outline" onClick={() => post.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <FeedSkeleton />
      )}
    </GlassPanel>
  );
}

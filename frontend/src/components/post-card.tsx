"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { Pin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedReasonBadge } from "@/components/feed-reason-badge";
import { PostActions } from "@/components/post-actions";
import { PostMenu } from "@/components/post-menu";
import { SyntheticBadge } from "@/components/synthetic-badge";
import { UnfollowDialog } from "@/components/unfollow-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { topicLabel } from "@/lib/constants";
import { fullDate, relativeTime } from "@/lib/format";
import type { Post, ReasonCode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PostCardVariant = "feed" | "detail" | "profile" | "pinned";

interface PostCardProps {
  post: Post;
  variant: PostCardVariant;
  /** Feed only: why this post is here. */
  reason?: ReasonCode;
  /** Detail only: Reply focuses the comment box. */
  onReply?: () => void;
}

/** One `<article>` row inside a glass sheet. */
export function PostCard({ post, variant, reason, onReply }: PostCardProps) {
  const nameId = useId();
  const noteRef = useRef<HTMLParagraphElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [unfollowOpen, setUnfollowOpen] = useState(false);
  const { author } = post;
  const linkBody = variant !== "detail";
  const showNote = variant === "feed" && post.viewer_has_unfollowed_author;

  return (
    <>
      {showNote ? (
        <p
          ref={noteRef}
          tabIndex={-1}
          className="px-4 py-4 text-ui text-muted-foreground outline-none focus-visible:bg-secondary/60 lg:px-5"
        >
          You unfollowed @{author.username}. Their posts won&apos;t appear in your feed.
        </p>
      ) : (
        <article
          ref={articleRef}
          aria-labelledby={nameId}
          className="px-4 py-4 transition-colors duration-150 hover:bg-secondary/50 lg:px-5"
        >
          {variant === "pinned" ? (
            <p className="mb-2 flex items-center gap-1.5 text-meta font-semibold text-accent-foreground">
              <Pin aria-hidden="true" className="size-3.5" />
              Your new post, pinned here for now
            </p>
          ) : null}
          {variant === "feed" && reason ? (
            <div className="mb-2">
              <FeedReasonBadge code={reason} />
            </div>
          ) : null}

          <div className="flex gap-3">
            <Link href={`/u/${author.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
              <UserAvatar user={author} size={40} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-muted-foreground">
                  <Link
                    id={nameId}
                    href={`/u/${author.username}`}
                    className="truncate text-ui font-semibold text-foreground hover:underline"
                  >
                    {author.display_name}
                  </Link>
                  {author.is_synthetic ? <SyntheticBadge /> : null}
                  <span>@{author.username}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={post.created_at} title={fullDate(post.created_at)}>
                    {relativeTime(post.created_at)}
                  </time>
                  <span aria-hidden="true">·</span>
                  <span>{topicLabel(post.topic)}</span>
                </p>
                <PostMenu
                  post={post}
                  onUnfollow={variant === "pinned" ? undefined : () => setUnfollowOpen(true)}
                  leaveOnDelete={variant === "detail"}
                />
              </div>

              {linkBody ? (
                <Link
                  href={`/p/${post.id}`}
                  className="mt-1 block rounded-sm text-post break-words whitespace-pre-wrap text-foreground"
                >
                  {post.body}
                </Link>
              ) : (
                <p className="mt-1 text-post break-words whitespace-pre-wrap">{post.body}</p>
              )}

              <PostActions post={post} onReply={onReply} />
            </div>
          </div>
        </article>
      )}

      {!post.is_own ? (
        <UnfollowDialog
          author={author}
          open={unfollowOpen}
          onOpenChange={setUnfollowOpen}
          returnFocusTo={() =>
            noteRef.current ?? articleRef.current?.querySelector<HTMLElement>('button[aria-label="More actions"]') ?? null
          }
        />
      ) : null}
    </>
  );
}

export function PostCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex gap-3 px-4 py-4 lg:px-5", className)}>
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2.5 pt-1">
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  );
}

/** Three skeleton rows with a slow sheen. */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading posts" className="divide-y divide-divider">
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  );
}

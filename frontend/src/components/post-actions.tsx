"use client";

import Link from "next/link";
import { MessageCircle, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { usePostDislike } from "@/hooks/use-post-dislike";
import { DISLIKE_REASONS } from "@/lib/constants";
import { plural } from "@/lib/format";
import type { DislikeReason, Post } from "@/lib/types";
import { cn } from "@/lib/utils";

const iconButton = "h-11 gap-1.5 px-2.5 text-meta tabular-nums lg:h-8";

/** "{n} dislikes" with the public reason breakdown. It never shows who (Q32). */
export function DislikeCount({ post, className }: { post: Post; className?: string }) {
  const n = post.dislike_count;
  const r = post.dislike_reasons;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${n} dislikes, show breakdown`}
          className={cn(iconButton, "min-w-8 px-2 text-current hover:text-current", className)}
        >
          {n}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-80 text-ui">
        {n === 0 ? (
          <p>No dislikes yet.</p>
        ) : (
          <p className="tabular-nums">
            {n} dislikes: Disagree {r.disagree} · Low effort {r.low_effort} · Not for me {r.not_for_me} · No
            reason {r.none}
          </p>
        )}
        <p className="text-meta text-muted-foreground">Nobody can see who disliked.</p>
      </PopoverContent>
    </Popover>
  );
}

interface PostActionsProps {
  post: Post;
  /** On the detail page, Reply focuses the comment box instead of linking. */
  onReply?: () => void;
}

/** Reply + Dislike only. Dislike is optimistic; the post stays where it is (Q6). */
export function PostActions({ post, onReply }: PostActionsProps) {
  const { announcement, dislike, setReason, remove } = usePostDislike(post);
  const disliked = post.viewer_dislike !== null;
  const replyLabel = post.reply_count === 0 ? "Reply" : plural(post.reply_count, "1 reply", "{n} replies");
  const replyContent = (
    <>
      <MessageCircle aria-hidden="true" />
      <span aria-hidden="true">{post.reply_count}</span>
    </>
  );

  return (
    <div className="mt-2">
      <div className="-ml-2.5 flex items-center gap-3">
        {onReply ? (
          <Button variant="ghost" size="sm" className={iconButton} aria-label={replyLabel} onClick={onReply}>
            {replyContent}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className={iconButton} asChild>
            <Link href={`/p/${post.id}`} aria-label={replyLabel}>
              {replyContent}
            </Link>
          </Button>
        )}

        {post.is_own ? (
          <span className="inline-flex items-center text-muted-foreground">
            <ThumbsDown aria-hidden="true" className="ml-2.5 size-4" />
            <DislikeCount post={post} className="-ml-1" />
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full transition-colors duration-150",
              disliked ? "gloss-pill bg-dislike-bg text-dislike-fg" : "text-muted-foreground",
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={disliked}
              onClick={disliked ? remove : dislike}
              className={cn(
                iconButton,
                "pr-1",
                disliked && "font-semibold text-dislike-fg hover:bg-white/50 hover:text-dislike-fg",
              )}
            >
              <ThumbsDown aria-hidden="true" className={cn(disliked && "fill-current")} />
              {disliked ? "Disliked" : <span className="sr-only">Dislike</span>}
            </Button>
            <DislikeCount post={post} className={cn(disliked && "hover:bg-white/50")} />
          </span>
        )}
      </div>

      {disliked && !post.is_own ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 animate-in duration-150 fade-in-0 slide-in-from-top-1">
          <span className="text-meta text-muted-foreground">Why? (optional)</span>
          <ToggleGroup
            type="single"
            aria-label="Dislike reason (optional)"
            spacing={2}
            value={post.viewer_dislike?.reason ?? ""}
            onValueChange={(value) => setReason((value || null) as DislikeReason | null)}
            className="flex-wrap"
          >
            {DISLIKE_REASONS.map((reason) => (
              <ToggleGroupItem
                key={reason.value}
                value={reason.value}
                className="gloss-pill h-11 rounded-full border border-input/40 bg-white/80 px-3 text-meta text-foreground hover:bg-secondary data-[state=on]:gel lg:h-8"
              >
                {reason.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="ghost" size="sm" className="text-meta" onClick={remove}>
            Undo
          </Button>
        </div>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComposer } from "@/components/composer-provider";
import { Orb } from "@/components/orb";
import { TOPIC_COUNT } from "@/lib/constants";
import type { Post } from "@/lib/types";

const SUMMARY_MIN_POSTS = 5;

/** The designed end of the feed: never a spinner, no suggestions, no auto-refresh. */
export function CaughtUpState({ posts }: { posts: Post[] }) {
  const { openComposer } = useComposer();
  const voices = new Set(posts.map((p) => p.author.id)).size;
  const topics = new Set(posts.map((p) => p.topic)).size;

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <Orb tone="green" size={56}>
        <Check className="size-7 drop-shadow-[0_1px_1px_rgb(0_0_0/0.3)]" strokeWidth={3} />
      </Orb>
      <h2 className="mt-4 text-display font-bold">You&apos;re caught up</h2>
      <p className="mt-2 max-w-sm text-ui text-muted-foreground">
        That&apos;s every post we have for you right now. New posts show up here as people write them.
      </p>
      {posts.length >= SUMMARY_MIN_POSTS ? (
        <p className="mt-4 max-w-sm text-ui tabular-nums">
          This visit: {posts.length} posts from {voices} voices, across {topics} of {TOPIC_COUNT} topics.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="gel" onClick={openComposer}>
          Write a post
        </Button>
        <Button variant="outline" asChild>
          <Link href="/algorithm">How it works</Link>
        </Button>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { GlassPanel } from "@/components/glass-panel";
import { FeedSkeleton } from "@/components/post-card";
import { PostDetail } from "@/components/post-detail";

export const metadata: Metadata = { title: "Post" };

export default function PostPage({ params }: PageProps<"/p/[id]">) {
  return (
    <Suspense
      fallback={
        <GlassPanel>
          <FeedSkeleton />
        </GlassPanel>
      }
    >
      <PostDetail params={params} />
    </Suspense>
  );
}

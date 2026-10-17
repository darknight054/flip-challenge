import { Suspense } from "react";
import type { Metadata } from "next";
import { GlassPanel } from "@/components/glass-panel";
import { FeedSkeleton } from "@/components/post-card";
import { ProfileView } from "@/components/profile-view";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <Suspense
      fallback={
        <GlassPanel>
          <FeedSkeleton />
        </GlassPanel>
      }
    >
      <ProfileView params={params} />
    </Suspense>
  );
}

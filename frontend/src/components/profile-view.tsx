"use client";

import { use, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Loader2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { EveryoneBubbles, EveryoneStat } from "@/components/everyone-stat";
import { BackButton, GlassPanel } from "@/components/glass-panel";
import { FeedSkeleton, PostCard } from "@/components/post-card";
import { UnfollowDialog } from "@/components/unfollow-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/cache";
import { FEED_PAGE_SIZE } from "@/lib/constants";
import { dayMonth } from "@/lib/format";
import type { Profile } from "@/lib/types";

function ProfileHeader({ profile }: { profile: Profile }) {
  const { user } = profile;
  const [unfollowOpen, setUnfollowOpen] = useState(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  return (
    <header className="px-4 py-5 lg:px-5">
      <div className="flex items-start justify-between gap-3">
        <UserAvatar user={user} size={72} />
        {profile.is_self ? (
          <EditProfileDialog user={user} />
        ) : profile.viewer_has_unfollowed ? null : (
          <Button variant="outline" onClick={() => setUnfollowOpen(true)}>
            <UserMinus aria-hidden="true" />
            Unfollow
          </Button>
        )}
      </div>
      {profile.is_self ? null : (
        <UnfollowDialog
          author={user}
          open={unfollowOpen}
          onOpenChange={setUnfollowOpen}
          returnFocusTo={() => noticeRef.current}
        />
      )}
      <h1 className="mt-3 flex flex-wrap items-center gap-2 text-title font-bold">
        {user.display_name}
      </h1>
      <p className="text-meta text-muted-foreground">@{user.username}</p>
      {user.bio ? <p className="mt-2 text-ui break-words whitespace-pre-wrap">{user.bio}</p> : null}

      {profile.viewer_has_unfollowed ? (
        <p ref={noticeRef} tabIndex={-1} className="mt-4 rounded-md bg-muted px-3 py-2.5 text-ui text-muted-foreground outline-none">
          You unfollowed {user.display_name}
          {profile.unfollowed_at ? ` on ${dayMonth(profile.unfollowed_at)}` : ""}. Their posts don&apos;t appear in
          your feed.
        </p>
      ) : null}

      <div className="mt-5">
        <EveryoneStat createdAt={user.created_at} />
      </div>
      <EveryoneBubbles className="mt-4" />
    </header>
  );
}

function ProfilePosts({ profile }: { profile: Profile }) {
  const { username, display_name } = profile.user;
  const posts = useInfiniteQuery({
    queryKey: qk.userPosts(username),
    queryFn: ({ pageParam }) => api.userPosts(username, pageParam, FEED_PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  const items = posts.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="profile-posts" className="border-t border-divider">
      <h2 id="profile-posts" className="px-4 pt-4 pb-1 text-heading font-semibold lg:px-5">
        Posts
      </h2>
      {posts.isPending ? (
        <FeedSkeleton />
      ) : posts.isError && !posts.data ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-ui text-muted-foreground">{errorMessage(posts.error, "Couldn't load posts.")}</p>
          <Button variant="outline" onClick={() => posts.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-center text-ui text-muted-foreground lg:px-5">
          {profile.is_self ? "You haven't posted yet." : `${display_name} hasn't posted yet.`}
        </p>
      ) : (
        <>
          <div className="divide-y divide-divider">
            {items.map((post) => (
              <div key={post.id}>
                <PostCard post={post} variant="profile" />
              </div>
            ))}
          </div>
          {posts.hasNextPage ? (
            <div className="flex justify-center border-t border-divider px-4 py-6">
              <Button
                variant="gel"
                onClick={() => posts.fetchNextPage()}
                disabled={posts.isFetchingNextPage}
                aria-busy={posts.isFetchingNextPage}
              >
                {posts.isFetchingNextPage ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
                Show more posts
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The "everyone" profile (Q31): identical stats on every profile, one-button unfollow. */
export function ProfileView({ params }: { params: Promise<{ username: string }> }) {
  const { username: raw } = use(params);
  const username = decodeURIComponent(raw);
  const profile = useQuery({ queryKey: qk.user(username), queryFn: () => api.user(username) });

  return (
    <GlassPanel aria-label="Profile">
      <div className="border-b border-divider px-4 py-2 lg:px-5">
        <BackButton />
      </div>
      {profile.data ? (
        <>
          <ProfileHeader profile={profile.data} />
          <ProfilePosts profile={profile.data} />
        </>
      ) : profile.isError ? (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p className="text-ui text-muted-foreground">{errorMessage(profile.error, "Couldn't load this profile.")}</p>
          <Button variant="outline" onClick={() => profile.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <FeedSkeleton />
      )}
    </GlassPanel>
  );
}

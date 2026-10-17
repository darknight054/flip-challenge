"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/glass-panel";
import { Orb } from "@/components/orb";
import { FeedSkeleton } from "@/components/post-card";
import { UserAvatar } from "@/components/user-avatar";
import { useUnfollow } from "@/hooks/use-unfollow";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import { dayMonth } from "@/lib/format";
import type { AuthorSummary, UnfollowList } from "@/lib/types";

/** People you've unfollowed, newest first. Neutral: no counts, no meter, no nudges (Q34). */
export function UnfollowedList() {
  const qc = useQueryClient();
  const { undo } = useUnfollow();
  const list = useQuery({ queryKey: qk.unfollows, queryFn: api.myUnfollows });

  const undoUnfollow = (user: AuthorSummary) => {
    qc.setQueryData<UnfollowList>(qk.unfollows, (data) =>
      data && { items: data.items.filter((item) => item.user.id !== user.id) },
    );
    undo.mutate(user);
  };

  return (
    <GlassPanel aria-labelledby="unfollowed-title">
      <header className="border-b border-divider px-4 py-5 lg:px-5">
        <h1 id="unfollowed-title" className="text-title font-bold">
          Unfollowed
        </h1>
        <p className="mt-1 text-ui text-muted-foreground">
          People you&apos;ve unfollowed. Their posts don&apos;t appear in your feed.
        </p>
      </header>

      {list.isPending ? (
        <FeedSkeleton />
      ) : list.isError ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
          <p className="text-ui text-muted-foreground">Couldn&apos;t load this list.</p>
          <Button variant="outline" onClick={() => list.refetch()}>
            Try again
          </Button>
        </div>
      ) : list.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
          <Orb tone="green" size={56}>
            <Sparkles className="size-7" />
          </Orb>
          <p className="text-ui text-muted-foreground">You haven&apos;t unfollowed anyone.</p>
        </div>
      ) : (
        <ul className="divide-y divide-divider">
          {list.data.items.map(({ user, unfollowed_at }) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3 lg:px-5">
              <UserAvatar user={user} size={40} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/u/${user.username}`} className="truncate font-semibold hover:underline">
                    {user.display_name}
                  </Link>
                </p>
                <p className="text-meta text-muted-foreground">
                  @{user.username} · <time dateTime={unfollowed_at}>{dayMonth(unfollowed_at)}</time>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => undoUnfollow(user)}>
                Undo unfollow
              </Button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}

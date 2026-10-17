"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { qk, updateComments, updatePosts } from "@/lib/cache";
import { UNDO_TOAST_MS } from "@/lib/constants";
import type { AuthorSummary, Profile } from "@/lib/types";

/**
 * Unfollow and undo, both optimistic. Unfollowing swaps every loaded post by that author for a
 * one-line note and collapses their comments; a toast offers Undo for 6 s (Q35).
 */
export function useUnfollow() {
  const qc = useQueryClient();

  const setUnfollowed = (username: string, unfollowed: boolean, at: string | null) => {
    updatePosts(
      qc,
      (p) => p.author.username === username,
      (p) => ({ ...p, viewer_has_unfollowed_author: unfollowed }),
    );
    updateComments(qc, null, (c) => (c.author?.username === username ? { ...c, collapsed: unfollowed } : c));
    qc.setQueryData<Profile>(qk.user(username), (profile) =>
      profile && { ...profile, viewer_has_unfollowed: unfollowed, unfollowed_at: at },
    );
  };

  const undo = useMutation({
    mutationFn: (author: AuthorSummary) => api.undoUnfollow(author.username),
    onMutate: (author) => {
      const previous = qc.getQueryData<Profile>(qk.user(author.username))?.unfollowed_at ?? null;
      setUnfollowed(author.username, false, null);
      return { previous };
    },
    onError: (error, author, context) => {
      setUnfollowed(author.username, true, context?.previous ?? new Date().toISOString());
      toast.error(errorMessage(error, "Couldn't undo that. Try again."));
    },
    onSuccess: (_state, author) => {
      toast.success(`${author.display_name} is back in your feed.`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.unfollows }),
  });

  const unfollow = useMutation({
    mutationFn: (author: AuthorSummary) => api.unfollow(author.username),
    onMutate: (author) => setUnfollowed(author.username, true, new Date().toISOString()),
    onError: (_error, author) => setUnfollowed(author.username, false, null),
    onSuccess: (state, author) => {
      setUnfollowed(author.username, true, state.unfollowed_at);
      toast(`You unfollowed ${author.display_name}.`, {
        duration: UNDO_TOAST_MS,
        action: { label: "Undo", onClick: () => undo.mutate(author) },
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.unfollows }),
  });

  return { unfollow, undo };
}

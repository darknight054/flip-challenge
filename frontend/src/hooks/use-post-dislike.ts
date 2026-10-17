"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { updateComments, updatePost } from "@/lib/cache";
import type { Comment, DislikeReason, DislikeReasons, Post, ViewerDislike } from "@/lib/types";

type DislikeFields = Pick<Post, "dislike_count" | "dislike_reasons" | "viewer_dislike">;

/** `{ reason: null }` dislikes without a reason; `{ remove: true }` removes the dislike. */
type DislikeAction = { reason: DislikeReason | null } | { remove: true };

function reasonKey(dislike: ViewerDislike): keyof DislikeReasons {
  return dislike.reason ?? "none";
}

function applyDislike(post: Post, next: ViewerDislike | null): DislikeFields {
  const reasons = { ...post.dislike_reasons };
  let count = post.dislike_count;
  if (post.viewer_dislike) {
    const key = reasonKey(post.viewer_dislike);
    reasons[key] = Math.max(0, reasons[key] - 1);
    count = Math.max(0, count - 1);
  }
  if (next) {
    reasons[reasonKey(next)] += 1;
    count += 1;
  }
  return { dislike_count: count, dislike_reasons: reasons, viewer_dislike: next };
}

/** Optimistic post dislike: the post stays where it is (Q6), counts update at once. */
export function usePostDislike(post: Post) {
  const qc = useQueryClient();
  const [announcement, setAnnouncement] = useState("");

  const mutation = useMutation({
    mutationFn: (action: DislikeAction) =>
      "remove" in action ? api.removePostDislike(post.id) : api.dislikePost(post.id, action.reason),
    onMutate: (action) => {
      const previous: DislikeFields = {
        dislike_count: post.dislike_count,
        dislike_reasons: post.dislike_reasons,
        viewer_dislike: post.viewer_dislike,
      };
      const next = "remove" in action ? null : { reason: action.reason };
      updatePost(qc, post.id, (p) => ({ ...p, ...applyDislike(p, next) }));
      if ("remove" in action) setAnnouncement("Dislike removed.");
      else if (!post.viewer_dislike) setAnnouncement("Disliked. You can add a reason.");
      return { previous };
    },
    onError: (_error, _action, context) => {
      if (context) updatePost(qc, post.id, (p) => ({ ...p, ...context.previous }));
      toast.error("Couldn't save your dislike. Try again.");
    },
    onSuccess: (state) => {
      updatePost(qc, post.id, (p) => ({
        ...p,
        dislike_count: state.dislike_count,
        dislike_reasons: state.dislike_reasons,
        viewer_dislike: state.viewer_dislike,
      }));
    },
  });

  return {
    announcement,
    dislike: () => mutation.mutate({ reason: null }),
    setReason: (reason: DislikeReason | null) => mutation.mutate({ reason }),
    remove: () => mutation.mutate({ remove: true }),
  };
}

/** Optimistic comment dislike: icon + count only, no reasons (Q32). */
export function useCommentDislike(comment: Comment) {
  const qc = useQueryClient();
  const [announcement, setAnnouncement] = useState("");
  const patch = (fields: Pick<Comment, "dislike_count" | "viewer_disliked">) =>
    updateComments(qc, comment.post_id, (c) => (c.id === comment.id ? { ...c, ...fields } : c));

  const mutation = useMutation({
    mutationFn: (disliked: boolean) =>
      disliked ? api.dislikeComment(comment.id) : api.removeCommentDislike(comment.id),
    onMutate: (disliked) => {
      const previous = { dislike_count: comment.dislike_count, viewer_disliked: comment.viewer_disliked };
      patch({
        viewer_disliked: disliked,
        dislike_count: Math.max(0, comment.dislike_count + (disliked ? 1 : -1)),
      });
      setAnnouncement(disliked ? "Disliked." : "Dislike removed.");
      return { previous };
    },
    onError: (_error, _disliked, context) => {
      if (context) patch(context.previous);
      toast.error("Couldn't save your dislike. Try again.");
    },
    onSuccess: (state) => patch({ dislike_count: state.dislike_count, viewer_disliked: state.viewer_disliked }),
  });

  return { announcement, toggle: () => mutation.mutate(!comment.viewer_disliked) };
}

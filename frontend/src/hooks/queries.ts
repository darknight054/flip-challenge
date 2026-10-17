"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/cache";
import { TOPICS } from "@/lib/constants";
import type { Post } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: api.me,
    select: (data) => data.user,
    staleTime: 5 * 60_000,
  });
}

export function useTopics() {
  return useQuery({
    queryKey: qk.topics,
    queryFn: api.topics,
    select: (data) => data.items,
    placeholderData: { items: TOPICS },
    staleTime: Infinity,
  });
}

export function useRecipe() {
  return useQuery({ queryKey: qk.recipe, queryFn: api.recipe, staleTime: 10 * 60_000 });
}

const NO_POSTS: Post[] = [];

/**
 * Posts created during this page load, pinned at the top of the feed (Q14). Client-only state:
 * the composer writes it with setQueryData; it is never fetched.
 */
export function usePinnedPosts(): Post[] {
  const { data } = useQuery<Post[]>({ queryKey: qk.pinned, queryFn: skipToken, gcTime: Infinity });
  return data ?? NO_POSTS;
}

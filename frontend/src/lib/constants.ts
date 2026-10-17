import type { DislikeReason, ReasonCode, Topic, TopicSlug } from "@/lib/types";

/** Every profile shows the same follower count (Q31). Not API data; change it here. */
export const PROFILE_FOLLOWERS_LABEL = "1bn+";

export const POST_MAX = 500;
export const POST_COUNTER_FROM = 400;
export const COMMENT_MAX = 300;
export const COMMENT_COUNTER_FROM = 250;
export const BIO_MAX = 160;
export const DISPLAY_NAME_MAX = 40;
export const FEED_PAGE_SIZE = 20;
export const UNDO_TOAST_MS = 6000;

/** Fixed topic order (GET /topics). Used as placeholder data and for labels. */
export const TOPICS: Topic[] = [
  { slug: "science", label: "Science" },
  { slug: "tech", label: "Tech" },
  { slug: "politics_society", label: "Politics & Society" },
  { slug: "culture_arts", label: "Culture & Arts" },
  { slug: "sport", label: "Sport" },
  { slug: "food", label: "Food" },
  { slug: "places_travel", label: "Places & Travel" },
  { slug: "work_money", label: "Work & Money" },
  { slug: "health", label: "Health" },
  { slug: "everyday_life", label: "Everyday Life" },
];
export const TOPIC_COUNT = TOPICS.length;

export function topicLabel(slug: TopicSlug): string {
  return TOPICS.find((t) => t.slug === slug)?.label ?? slug;
}

export const DISLIKE_REASONS: { value: DislikeReason; label: string }[] = [
  { value: "disagree", label: "Disagree" },
  { value: "low_effort", label: "Low effort" },
  { value: "not_for_me", label: "Not for me" },
];

/** Reason badge copy (FRONTEND_TEMPLATES §5, §6). Icons live in feed-reason-badge.tsx. */
export const REASONS: Record<ReasonCode, { label: string; text: string; badge: string; segment: string }> = {
  fresh: {
    label: "Fresh",
    text: "A new post or a new voice. First posts are guaranteed some readers.",
    badge: "bg-reason-fresh-bg text-reason-fresh",
    segment: "bg-reason-fresh",
  },
  underexposed: {
    label: "Underexposed",
    text: "A voice few people have seen yet.",
    badge: "bg-reason-underexposed-bg text-reason-underexposed",
    segment: "bg-reason-underexposed",
  },
  discussion: {
    label: "Discussion",
    text: "Several different people are replying to this.",
    badge: "bg-reason-discussion-bg text-reason-discussion",
    segment: "bg-reason-discussion",
  },
  wildcard: {
    label: "Wildcard",
    text: "Picked at random from posts you haven't seen.",
    badge: "bg-reason-wildcard-bg text-reason-wildcard",
    segment: "bg-reason-wildcard",
  },
  outside_your_usual: {
    label: "Outside your usual",
    text: "A topic or voice you haven't seen much of lately.",
    badge: "bg-reason-outside-bg text-reason-outside",
    segment: "bg-reason-outside",
  },
  contested: {
    label: "Contested",
    text: "People disagree about this and are talking it through.",
    badge: "bg-reason-contested-bg text-reason-contested",
    segment: "bg-reason-contested",
  },
};

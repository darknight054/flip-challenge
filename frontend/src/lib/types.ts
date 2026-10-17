// Copied from docs/API_CONTRACT.md (v1, frozen). Do not edit without updating the contract.

export type TopicSlug = "science" | "tech" | "politics_society" | "culture_arts" | "sport"
               | "food" | "places_travel" | "work_money" | "health" | "everyday_life";
export type DislikeReason = "disagree" | "low_effort" | "not_for_me";
export type ReasonCode = "fresh" | "underexposed" | "discussion" | "wildcard"
                | "outside_your_usual" | "contested";            // outside_your_usual: seen-least-v1; contested: Phase 2

export interface AuthorSummary { id: number; username: string; display_name: string;
                          avatar_url: string | null; is_synthetic: boolean }
export interface User extends AuthorSummary { bio: string; created_at: string }
export interface Me extends User { is_admin: boolean }

export interface Topic { slug: TopicSlug; label: string }

export interface DislikeReasons { disagree: number; low_effort: number; not_for_me: number; none: number }
export interface ViewerDislike { reason: DislikeReason | null }

export interface Post {
  id: number; author: AuthorSummary; body: string; topic: TopicSlug;
  created_at: string; updated_at: string | null;
  reply_count: number;
  dislike_count: number; dislike_reasons: DislikeReasons;   // public, never who (Q8, Q32)
  viewer_dislike: ViewerDislike | null;                       // null = viewer hasn't disliked
  viewer_has_unfollowed_author: boolean;
  is_own: boolean;
}

export interface FeedItem { post: Post; reason_code: ReasonCode; reason_text: string }
export interface FeedPage { items: FeedItem[]; session_id: string; next_cursor: string | null;
                     end_of_feed: boolean; algorithm_version: string }

export interface Comment {
  id: number; post_id: number; parent_id: number | null;
  author: AuthorSummary | null;          // null only when deleted
  body: string;                          // "" when deleted
  deleted: boolean;
  created_at: string; updated_at: string | null;
  dislike_count: number; viewer_disliked: boolean; is_own: boolean;
  collapsed: boolean;                    // author is someone the viewer unfollowed (Q11)
  replies: Comment[];                    // top-level only; replies never nest further
}
export interface CommentPage { items: Comment[]; next_cursor: string | null }
export interface PostPage { items: Post[]; next_cursor: string | null }

export interface Profile { user: User; is_self: boolean;
                    viewer_has_unfollowed: boolean; unfollowed_at: string | null }
// No follower/following numbers exist. The "1bn+ followers" stat is a frontend constant (Q31).

export interface UnfollowState { username: string; unfollowed: boolean; unfollowed_at: string | null }
export interface UnfollowList { items: { user: AuthorSummary; unfollowed_at: string }[] }

export interface PostDislikeState { post_id: number; dislike_count: number;
                             dislike_reasons: DislikeReasons; viewer_dislike: ViewerDislike | null }
export interface CommentDislikeState { comment_id: number; dislike_count: number; viewer_disliked: boolean }

export interface Pool { code: ReasonCode; label: string; share: number; description: string }
export interface Recipe { active_version: string; pools: Pool[]; never_used: string[] }

export interface ComparisonSlot { position: number; post_id: number; topic: TopicSlug;
                           author: { username: string; display_name: string; is_synthetic: boolean } }
export interface Ranker { key: string; label: string; demo_only: boolean; slots: ComparisonSlot[];
                   metrics: { attention_gap: number; topics_covered: number; distinct_creators: number } }
export interface Comparison { dataset: { posts: number; creators: number; simulated_viewers: number };
                       slate_size: number; rankers: Ranker[] }

export interface Report { id: number; subject_type: "post" | "comment"; subject_id: number;
                   reason: "spam" | "abuse" | "other"; note: string | null;
                   status: "open" | "resolved"; created_at: string;
                   reporter: AuthorSummary; subject_preview: string }

// Error envelope: every non-2xx response is { error: ErrorBody }.
export type ErrorCode =
  | "unauthenticated" | "invalid_credentials"
  | "forbidden" | "csrf_failed" | "own_content"
  | "not_found"
  | "username_taken"
  | "validation_error" | "self_unfollow" | "reply_depth"
  | "rate_limited";
export interface ErrorBody { code: ErrorCode; message: string;
                             fields?: Record<string, string>; retry_after?: number }

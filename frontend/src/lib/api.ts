import type {
  Comment,
  CommentDislikeState,
  CommentPage,
  Comparison,
  DislikeReason,
  ErrorBody,
  ErrorCode,
  FeedPage,
  Me,
  Post,
  PostDislikeState,
  PostPage,
  Profile,
  Recipe,
  Report,
  Topic,
  TopicSlug,
  UnfollowList,
  UnfollowState,
  PoolPreviewList,
  Simulation,
  ViewMix,
} from "@/lib/types";

const BASE = "/api/v1";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// "server_error" is frontend-only: a non-2xx response without the error envelope.
export type ApiErrorCode = ErrorCode | "server_error";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: Record<string, string>;
  readonly retry_after?: number;

  constructor(status: number, body: Omit<ErrorBody, "code"> & { code: ApiErrorCode }) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
    this.retry_after = body.retry_after;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Query = Record<string, string | number | null | undefined>;

interface RequestOptions {
  body?: unknown;
  query?: Query;
  keepalive?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const { pathname } = window.location;
  if (pathname === "/login" || pathname === "/register") return;
  // `session=expired` lets the proxy clear a stale cookie instead of bouncing back to "/".
  window.location.replace(`/login?session=expired&next=${encodeURIComponent(pathname)}`);
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const json = (await res.json()) as { error?: ErrorBody };
    if (json?.error) return new ApiError(res.status, json.error);
  } catch {
    // Not the JSON envelope (e.g. the API is down behind the rewrite).
  }
  return new ApiError(res.status, { code: "server_error", message: "Something went wrong. Try again." });
}

export async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (UNSAFE_METHODS.has(method)) headers["X-Serendipity-Client"] = "web";
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    credentials: "include",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    keepalive: opts.keepalive,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await parseError(res);
    if (error.status === 401 && error.code === "unauthenticated") redirectToLogin();
    throw error;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

// ---- Endpoints (API_CONTRACT.md § Endpoints) ----

export type ReportReason = Report["reason"];

export const api = {
  topics: () => request<{ items: Topic[] }>("GET", "/topics"),

  register: (body: { username: string; password: string; display_name?: string }) =>
    request<{ user: Me }>("POST", "/auth/register", { body }),
  login: (body: { username: string; password: string }) =>
    request<{ user: Me }>("POST", "/auth/login", { body }),
  logout: () => request<void>("POST", "/auth/logout"),

  me: () => request<{ user: Me }>("GET", "/me"),
  updateMe: (body: { display_name?: string; bio?: string }) =>
    request<{ user: Me }>("PATCH", "/me", { body }),
  myUnfollows: () => request<UnfollowList>("GET", "/me/unfollows"),

  user: (username: string) => request<Profile>("GET", `/users/${encodeURIComponent(username)}`),
  userPosts: (username: string, cursor?: string | null, limit = 20) =>
    request<PostPage>("GET", `/users/${encodeURIComponent(username)}/posts`, { query: { cursor, limit } }),
  unfollow: (username: string) =>
    request<UnfollowState>("PUT", `/users/${encodeURIComponent(username)}/unfollow`),
  undoUnfollow: (username: string) =>
    request<UnfollowState>("DELETE", `/users/${encodeURIComponent(username)}/unfollow`),

  createPost: (body: { body: string; topic: TopicSlug }) => request<Post>("POST", "/posts", { body }),
  post: (id: number) => request<Post>("GET", `/posts/${id}`),
  updatePost: (id: number, body: { body?: string; topic?: TopicSlug }) =>
    request<Post>("PATCH", `/posts/${id}`, { body }),
  deletePost: (id: number) => request<void>("DELETE", `/posts/${id}`),
  dislikePost: (id: number, reason: DislikeReason | null) =>
    request<PostDislikeState>("PUT", `/posts/${id}/dislike`, { body: { reason } }),
  removePostDislike: (id: number) => request<PostDislikeState>("DELETE", `/posts/${id}/dislike`),

  comments: (postId: number, cursor?: string | null, limit = 50) =>
    request<CommentPage>("GET", `/posts/${postId}/comments`, { query: { cursor, limit } }),
  createComment: (postId: number, body: { body: string; parent_id?: number }) =>
    request<Comment>("POST", `/posts/${postId}/comments`, { body }),
  updateComment: (id: number, body: { body: string }) =>
    request<Comment>("PATCH", `/comments/${id}`, { body }),
  deleteComment: (id: number) => request<void>("DELETE", `/comments/${id}`),
  dislikeComment: (id: number) => request<CommentDislikeState>("PUT", `/comments/${id}/dislike`),
  removeCommentDislike: (id: number) =>
    request<CommentDislikeState>("DELETE", `/comments/${id}/dislike`),

  feed: (cursor?: string | null, limit = 20) =>
    request<FeedPage>("GET", "/feed", { query: { cursor, limit } }),
  impressions: (
    body: { session_id: string; items: { post_id: number; position: number }[] },
    keepalive = false,
  ) => request<{ accepted: number; duplicates: number }>("POST", "/feed/impressions", { body, keepalive }),

  recipe: () => request<Recipe>("GET", "/algorithm/recipe"),
  comparison: () => request<Comparison>("GET", "/algorithm/comparison"),
  simulation: () => request<Simulation>("GET", "/algorithm/simulation"),
  pools: () => request<PoolPreviewList>("GET", "/algorithm/pools"),
  viewMix: () => request<ViewMix>("GET", "/me/view-mix"),

  report: (body: { subject_type: "post" | "comment"; subject_id: number; reason: ReportReason; note?: string | null }) =>
    request<{ id: number; status: Report["status"] }>("POST", "/reports", { body }),
};

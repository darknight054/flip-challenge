import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import type { Comment, CommentPage, FeedPage, Post, PostPage } from "@/lib/types";

export const qk = {
  me: ["me"] as const,
  topics: ["topics"] as const,
  recipe: ["recipe"] as const,
  comparison: ["comparison"] as const,
  feed: ["feed"] as const,
  /** Posts created this page load, pinned at the top of the feed (Q14). Client-only. */
  pinned: ["pinned-posts"] as const,
  posts: ["post"] as const,
  post: (id: number) => ["post", id] as const,
  allComments: ["comments"] as const,
  comments: (postId: number) => ["comments", postId] as const,
  user: (username: string) => ["user", username] as const,
  allUserPosts: ["user-posts"] as const,
  userPosts: (username: string) => ["user-posts", username] as const,
  unfollows: ["unfollows"] as const,
};

type PostMatch = (post: Post) => boolean;
type PostUpdate = (post: Post) => Post;

/** Apply `update` to every cached copy of matching posts: feed, profile lists, detail, pinned. */
export function updatePosts(qc: QueryClient, match: PostMatch, update: PostUpdate) {
  const apply = (post: Post) => (match(post) ? update(post) : post);

  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feed }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((item) => ({ ...item, post: apply(item.post) })),
      })),
    },
  );
  qc.setQueriesData<InfiniteData<PostPage>>({ queryKey: qk.allUserPosts }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.map(apply) })),
    },
  );
  qc.setQueriesData<Post>({ queryKey: qk.posts }, (post) => (post ? apply(post) : post));
  qc.setQueryData<Post[]>(qk.pinned, (list) => list?.map(apply));
}

export function updatePost(qc: QueryClient, id: number, update: PostUpdate) {
  updatePosts(qc, (p) => p.id === id, update);
}

/** Drop a deleted post from every list. */
export function removePost(qc: QueryClient, id: number) {
  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: qk.feed }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((i) => i.post.id !== id) })),
    },
  );
  qc.setQueriesData<InfiniteData<PostPage>>({ queryKey: qk.allUserPosts }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.filter((p) => p.id !== id) })),
    },
  );
  qc.setQueryData<Post[]>(qk.pinned, (list) => list?.filter((p) => p.id !== id));
  qc.removeQueries({ queryKey: qk.post(id), exact: true });
}

type CommentUpdate = (comment: Comment) => Comment;

function mapComments(comments: Comment[], update: CommentUpdate): Comment[] {
  return comments.map((c) => {
    const next = update(c);
    return { ...next, replies: next.replies.map(update) };
  });
}

/** Apply `update` to every comment and reply in one post's thread (or all threads). */
export function updateComments(qc: QueryClient, postId: number | null, update: CommentUpdate) {
  qc.setQueriesData<InfiniteData<CommentPage>>(
    { queryKey: postId === null ? qk.allComments : qk.comments(postId) },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({ ...page, items: mapComments(page.items, update) })),
      },
  );
}

/** Add a just-created comment to its thread: top-level at the end, replies under their parent. */
export function insertComment(qc: QueryClient, comment: Comment) {
  qc.setQueryData<InfiniteData<CommentPage>>(qk.comments(comment.post_id), (data) => {
    if (!data) return data;
    if (comment.parent_id === null) {
      const pages = [...data.pages];
      const last = pages.length - 1;
      pages[last] = { ...pages[last], items: [...pages[last].items, comment] };
      return { ...data, pages };
    }
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((c) =>
          c.id === comment.parent_id ? { ...c, replies: [...c.replies, comment] } : c,
        ),
      })),
    };
  });
}

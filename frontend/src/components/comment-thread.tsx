"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Pencil, ThumbsDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { PostCardSkeleton } from "@/components/post-card";
import { MoreActionsTrigger, ReportSubmenu, sendReport, useMenuDialogFocus } from "@/components/post-menu";
import { UserAvatar } from "@/components/user-avatar";
import { useMe } from "@/hooks/queries";
import { useCommentDislike } from "@/hooks/use-post-dislike";
import { api, errorMessage } from "@/lib/api";
import { insertComment, qk, updateComments, updatePost } from "@/lib/cache";
import { COMMENT_COUNTER_FROM, COMMENT_MAX } from "@/lib/constants";
import { fullDate, relativeTime } from "@/lib/format";
import type { Comment } from "@/lib/types";
import { cn } from "@/lib/utils";

function charCount(text: string) {
  return Array.from(text.trim()).length;
}

function Counter({ count }: { count: number }) {
  if (count < COMMENT_COUNTER_FROM) return null;
  const over = count - COMMENT_MAX;
  return (
    <span className={cn("text-meta tabular-nums", over > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
      {over > 0 ? `${over} characters over the limit` : `${count}/${COMMENT_MAX}`}
    </span>
  );
}

// ---- Writing ----

interface CommentFormProps {
  postId: number;
  parentId?: number;
  textareaId?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}

/** Add a comment (top of the thread) or a one-level reply. 300 characters, counter from 250. */
export function CommentForm({ postId, parentId, textareaId, autoFocus, onDone }: CommentFormProps) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [body, setBody] = useState("");
  const errorId = useId();
  const mutation = useMutation({
    mutationFn: (text: string) => api.createComment(postId, parentId ? { body: text, parent_id: parentId } : { body: text }),
    onSuccess: (comment) => {
      insertComment(qc, comment);
      updatePost(qc, postId, (p) => ({ ...p, reply_count: p.reply_count + 1 }));
      setBody("");
      onDone?.();
    },
  });
  const count = charCount(body);
  const canSend = count > 0 && count <= COMMENT_MAX && !mutation.isPending;
  const label = parentId ? "Reply" : "Comment";

  return (
    <form
      noValidate
      className="flex gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) mutation.mutate(body.trim());
      }}
    >
      {me ? <UserAvatar user={me} size={parentId ? 28 : 36} className="mt-1 shrink-0" /> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Textarea
            id={textareaId}
            autoFocus={autoFocus}
            aria-label={parentId ? "Reply text" : "Comment text"}
            placeholder={parentId ? "Add a reply" : "Add a comment"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSend) {
                e.preventDefault();
                mutation.mutate(body.trim());
              }
              if (e.key === "Escape" && onDone && parentId) onDone();
            }}
            aria-invalid={count > COMMENT_MAX || mutation.isError || undefined}
            aria-describedby={mutation.isError ? errorId : undefined}
            className="max-h-40 min-h-11 resize-none text-comment lg:min-h-10"
          />
          <Button type="submit" variant="gel" disabled={!canSend} className="shrink-0">
            {label}
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          {mutation.isError ? (
            <p id={errorId} role="alert" className="text-meta text-destructive">
              {errorMessage(mutation.error, "Couldn't send. Try again.")}
            </p>
          ) : (
            <span />
          )}
          <Counter count={count} />
        </div>
      </div>
    </form>
  );
}

function EditCommentForm({ comment, onDone }: { comment: Comment; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState(comment.body);
  const mutation = useMutation({
    mutationFn: (text: string) => api.updateComment(comment.id, { body: text }),
    onSuccess: (updated) => {
      updateComments(qc, comment.post_id, (c) => (c.id === updated.id ? { ...updated, replies: c.replies } : c));
      onDone();
    },
  });
  const count = charCount(body);
  const canSave = count > 0 && count <= COMMENT_MAX && !mutation.isPending;

  return (
    <form
      className="mt-1 grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) mutation.mutate(body.trim());
      }}
    >
      <Textarea
        autoFocus
        aria-label="Comment text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="max-h-40 min-h-11 resize-none text-comment"
      />
      <div className="flex flex-wrap items-center gap-2">
        {mutation.isError ? (
          <p role="alert" className="text-meta text-destructive">
            {errorMessage(mutation.error, "Couldn't save. Try again.")}
          </p>
        ) : null}
        <Counter count={count} />
        <span className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="gel" size="sm" disabled={!canSave}>
            Save
          </Button>
        </span>
      </div>
    </form>
  );
}

// ---- Reading ----

function CommentDislike({ comment }: { comment: Comment }) {
  const { announcement, toggle } = useCommentDislike(comment);
  const count = (
    <span className="text-meta tabular-nums">
      {comment.dislike_count}
      <span className="sr-only"> dislikes</span>
    </span>
  );
  if (comment.is_own) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1 text-muted-foreground">
        <ThumbsDown aria-hidden="true" className="size-4" />
        {count}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full pr-2.5",
        comment.viewer_disliked ? "gloss-pill bg-dislike-bg text-dislike-fg" : "text-muted-foreground",
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-pressed={comment.viewer_disliked}
        aria-label={comment.viewer_disliked ? "Remove dislike" : "Dislike comment"}
        onClick={toggle}
        className={cn(comment.viewer_disliked && "text-dislike-fg hover:bg-white/50 hover:text-dislike-fg")}
      >
        <ThumbsDown aria-hidden="true" className={cn(comment.viewer_disliked && "fill-current")} />
      </Button>
      {count}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </span>
  );
}

function DeleteCommentDialog({
  comment,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  comment: Comment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.deleteComment(comment.id),
    onSuccess: () => {
      onOpenChange(false);
      updatePost(qc, comment.post_id, (p) => ({ ...p, reply_count: Math.max(0, p.reply_count - 1) }));
      qc.invalidateQueries({ queryKey: qk.comments(comment.post_id) });
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete the comment. Try again.")),
  });
  return (
    <AlertDialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
          <AlertDialogDescription>It will be removed for everyone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CommentViewProps {
  comment: Comment;
  onReply?: () => void;
  /** Shown above the author line when expanded from a collapsed state. */
  note?: React.ReactNode;
}

function CommentView({ comment, onReply, note }: CommentViewProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { triggerRef, beforeDialog, onMenuCloseAutoFocus, returnFocus } = useMenuDialogFocus();
  const author = comment.author;
  if (!author) return null;

  return (
    <div className="flex gap-3">
      <Link href={`/u/${author.username}`} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <UserAvatar user={author} size={32} />
      </Link>
      <div className="min-w-0 flex-1">
        {note}
        <div className="flex items-start gap-2">
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-meta text-muted-foreground">
            <Link href={`/u/${author.username}`} className="text-ui font-semibold text-foreground hover:underline">
              {author.display_name}
            </Link>
            <span>@{author.username}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={comment.created_at} title={fullDate(comment.created_at)}>
              {relativeTime(comment.created_at)}
            </time>
          </p>
          <DropdownMenu modal={false}>
            <MoreActionsTrigger ref={triggerRef} />
            <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={onMenuCloseAutoFocus}>
              {comment.is_own ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      beforeDialog();
                      setEditing(true);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                    Edit comment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      beforeDialog();
                      setDeleting(true);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete comment
                  </DropdownMenuItem>
                </>
              ) : (
                <ReportSubmenu onReport={(reason) => sendReport("comment", comment.id, reason)} />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {editing ? (
          <EditCommentForm comment={comment} onDone={() => setEditing(false)} />
        ) : (
          <p className="text-comment break-words whitespace-pre-wrap">{comment.body}</p>
        )}

        <div className="mt-1 -ml-2 flex items-center gap-2">
          {onReply ? (
            <Button variant="ghost" size="sm" className="text-meta" onClick={onReply}>
              Reply
            </Button>
          ) : null}
          <CommentDislike comment={comment} />
        </div>
      </div>
      {comment.is_own ? (
        <DeleteCommentDialog comment={comment} open={deleting} onOpenChange={setDeleting} onCloseAutoFocus={returnFocus} />
      ) : null}
    </div>
  );
}

/** A comment by someone you unfollowed collapses in place (Q11). */
function CollapsedComment({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {open ? null : (
        <div className="flex items-center gap-2 text-meta text-muted-foreground">
          <EyeOff aria-hidden="true" className="size-4" />
          <span>Comment from someone you unfollowed</span>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-meta"
              aria-controls={contentId}
              aria-label="Show comment from someone you unfollowed"
            >
              Show
            </Button>
          </CollapsibleTrigger>
        </div>
      )}
      <CollapsibleContent id={contentId}>
        <CommentView
          comment={comment}
          onReply={onReply}
          note={
            <p className="flex items-center gap-2 text-meta text-muted-foreground">
              <EyeOff aria-hidden="true" className="size-3.5" />
              From someone you unfollowed
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="xs" className="text-meta" aria-controls={contentId}>
                  Hide
                </Button>
              </CollapsibleTrigger>
            </p>
          }
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

function CommentEntry({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
  if (comment.deleted) {
    return <p className="py-1 text-meta text-muted-foreground italic">Comment deleted.</p>;
  }
  if (comment.collapsed) return <CollapsedComment comment={comment} onReply={onReply} />;
  return <CommentView comment={comment} onReply={onReply} />;
}

function TopLevelComment({ comment }: { comment: Comment }) {
  const [replying, setReplying] = useState(false);
  const canReply = !comment.deleted;
  return (
    <li className="px-4 py-4 lg:px-5">
      <CommentEntry comment={comment} onReply={canReply ? () => setReplying(true) : undefined} />
      {comment.replies.length > 0 || replying ? (
        <div className="mt-3 ml-4 space-y-4 border-l-2 border-divider pl-4">
          {comment.replies.map((reply) => (
            <CommentEntry key={reply.id} comment={reply} />
          ))}
          {replying ? (
            <CommentForm postId={comment.post_id} parentId={comment.id} autoFocus onDone={() => setReplying(false)} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Comments, oldest first, one level of replies. */
export function CommentList({ postId }: { postId: number }) {
  const comments = useInfiniteQuery({
    queryKey: qk.comments(postId),
    queryFn: ({ pageParam }) => api.comments(postId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });
  const items = comments.data?.pages.flatMap((page) => page.items) ?? [];

  if (comments.isPending) {
    return (
      <div role="status" aria-label="Loading comments" className="divide-y divide-divider">
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }
  if (comments.isError && !comments.data) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <p className="text-ui text-muted-foreground">Couldn&apos;t load comments.</p>
        <Button variant="outline" onClick={() => comments.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-divider">
        {items.map((comment) => (
          <TopLevelComment key={comment.id} comment={comment} />
        ))}
      </ul>
      {comments.hasNextPage ? (
        <div className="flex justify-center border-t border-divider px-4 py-4">
          <Button variant="outline" onClick={() => comments.fetchNextPage()} disabled={comments.isFetchingNextPage}>
            Show more comments
          </Button>
        </div>
      ) : null}
    </>
  );
}

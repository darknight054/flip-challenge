"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ellipsis, Flag, Link2, Pencil, Trash2, UserMinus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { TopicPicker } from "@/components/topic-picker";
import { api, errorMessage, isApiError, type ReportReason } from "@/lib/api";
import { removePost, updatePost } from "@/lib/cache";
import { POST_MAX } from "@/lib/constants";
import type { Post, TopicSlug } from "@/lib/types";

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Abuse" },
  { value: "other", label: "Other" },
];

export async function copyLink(path: string) {
  try {
    await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
    toast.success("Link copied.");
  } catch {
    toast.error("Couldn't copy the link.");
  }
}

export async function sendReport(subject_type: "post" | "comment", subject_id: number, reason: ReportReason) {
  try {
    await api.report({ subject_type, subject_id, reason, note: null });
    toast.success("Report sent. A moderator will review it.");
  } catch (error) {
    toast.error(errorMessage(error, "Couldn't send the report. Try again."));
  }
}

/** "Report" with its three API reasons as a submenu. */
export function ReportSubmenu({ onReport }: { onReport: (reason: ReportReason) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="gap-2 px-2 py-2.5 text-ui lg:py-1.5">
        <Flag aria-hidden="true" className="size-4" />
        Report
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {REPORT_REASONS.map((r) => (
          <DropdownMenuItem key={r.value} onSelect={() => onReport(r.value)}>
            {r.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function MoreActionsTrigger({ ref }: { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button ref={ref} variant="ghost" size="icon-sm" aria-label="More actions" className="-mr-2 -mt-1 shrink-0">
        <Ellipsis aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
  );
}

interface PostMenuProps {
  post: Post;
  /** Show "Unfollow @handle" (feed and detail variants, not after unfollowing). */
  onUnfollow?: () => void;
  /** After deleting from the detail page, leave the page. */
  leaveOnDelete?: boolean;
}

/** The ⋯ menu: Unfollow, Copy link and Report for others; Copy link, Edit and Delete for yours. */
/**
 * Menu items that open a dialog must stop the menu from returning focus to ⋯ as it closes,
 * or it steals focus from the dialog. Returns props for the content plus a `beforeDialog` hook.
 */
export function useMenuDialogFocus() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const beforeDialog = useCallback(() => {
    openingDialog.current = true;
  }, []);
  const onMenuCloseAutoFocus = useCallback((event: Event) => {
    if (openingDialog.current) event.preventDefault();
    openingDialog.current = false;
  }, []);
  /** For the dialog: give focus back to ⋯ when it closes. */
  const returnFocus = useCallback((event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  }, []);
  return { triggerRef, beforeDialog, onMenuCloseAutoFocus, returnFocus };
}

export function PostMenu({ post, onUnfollow, leaveOnDelete }: PostMenuProps) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const { triggerRef, beforeDialog, onMenuCloseAutoFocus, returnFocus } = useMenuDialogFocus();
  const openDialog = (which: "edit" | "delete") => {
    beforeDialog();
    setDialog(which);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <MoreActionsTrigger ref={triggerRef} />
        <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={onMenuCloseAutoFocus}>
          {!post.is_own && onUnfollow && !post.viewer_has_unfollowed_author ? (
            <DropdownMenuItem
              onSelect={() => {
                beforeDialog();
                onUnfollow();
              }}
            >
              <UserMinus aria-hidden="true" />
              Unfollow @{post.author.username}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => copyLink(`/p/${post.id}`)}>
            <Link2 aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          {post.is_own ? (
            <>
              <DropdownMenuItem onSelect={() => openDialog("edit")}>
                <Pencil aria-hidden="true" />
                Edit post
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => openDialog("delete")}>
                <Trash2 aria-hidden="true" />
                Delete post
              </DropdownMenuItem>
            </>
          ) : (
            <ReportSubmenu onReport={(reason) => sendReport("post", post.id, reason)} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {post.is_own ? (
        <>
          <EditPostDialog
            post={post}
            open={dialog === "edit"}
            onOpenChange={(o) => setDialog(o ? "edit" : null)}
            onCloseAutoFocus={returnFocus}
          />
          <DeletePostDialog
            post={post}
            open={dialog === "delete"}
            onOpenChange={(o) => setDialog(o ? "delete" : null)}
            onCloseAutoFocus={leaveOnDelete ? undefined : returnFocus}
            leaveOnDelete={leaveOnDelete}
          />
        </>
      ) : null}
    </>
  );
}

interface DialogProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}

function DeletePostDialog({
  post,
  open,
  onOpenChange,
  onCloseAutoFocus,
  leaveOnDelete,
}: DialogProps & { leaveOnDelete?: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => api.deletePost(post.id),
    onSuccess: () => {
      onOpenChange(false);
      toast.success("Post deleted.");
      if (leaveOnDelete) router.push("/");
      removePost(qc, post.id);
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't delete the post. Try again.")),
  });

  return (
    <AlertDialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
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

function EditPostDialog({ post, open, onOpenChange, onCloseAutoFocus }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription className="text-meta text-muted-foreground">Posts are public.</DialogDescription>
        </DialogHeader>
        {/* Keyed so the form starts from the saved post every time it opens. */}
        {open ? <EditPostForm key={post.id} post={post} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditPostForm({ post, onDone }: { post: Post; onDone: () => void }) {
  const qc = useQueryClient();
  const [body, setBody] = useState(post.body);
  const [topic, setTopic] = useState<TopicSlug>(post.topic);
  const mutation = useMutation({
    mutationFn: () => api.updatePost(post.id, { body: body.trim(), topic }),
    onSuccess: (updated) => {
      updatePost(qc, post.id, () => updated);
      onDone();
    },
  });
  const fieldErrors = isApiError(mutation.error, "validation_error") ? mutation.error.fields ?? {} : {};
  const over = body.length - POST_MAX;
  const canSave = body.trim().length > 0 && over <= 0 && !mutation.isPending;

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) mutation.mutate();
      }}
    >
      <Textarea
        aria-label="Post text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="max-h-56 min-h-28 text-post"
        aria-invalid={Boolean(fieldErrors.body) || over > 0 || undefined}
        aria-describedby={fieldErrors.body ? "edit-post-body-error" : undefined}
      />
      {fieldErrors.body ? (
        <p id="edit-post-body-error" className="text-meta text-destructive">
          {fieldErrors.body}
        </p>
      ) : over > 0 ? (
        <p className="text-meta text-destructive">{over} characters over the limit</p>
      ) : null}
      <TopicPicker value={topic} onChange={setTopic} invalid={Boolean(fieldErrors.topic)} />
      {mutation.isError && !fieldErrors.body ? (
        <p role="alert" className="text-meta text-destructive">
          {errorMessage(mutation.error, "Couldn't save. Try again.")}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="gel" disabled={!canSave}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

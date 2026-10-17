"use client";

import { useState } from "react";
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
import { useUnfollow } from "@/hooks/use-unfollow";
import { errorMessage } from "@/lib/api";
import type { AuthorSummary } from "@/lib/types";

interface UnfollowDialogProps {
  author: AuthorSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes when the dialog closes (e.g. the in-feed note once the card is gone). */
  returnFocusTo?: () => HTMLElement | null;
}

/** Glass confirm dialog. Unfollow is gel, deliberately not red. Initial focus is on Cancel. */
export function UnfollowDialog({ author, open, onOpenChange, returnFocusTo }: UnfollowDialogProps) {
  const { unfollow } = useUnfollow();
  const [error, setError] = useState<string | null>(null);
  const busy = unfollow.isPending;

  const changeOpen = (next: boolean) => {
    if (busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  };

  const confirm = async () => {
    setError(null);
    try {
      await unfollow.mutateAsync(author);
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Couldn't unfollow. Try again."));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          const target = returnFocusTo?.();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Unfollow {author.display_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their posts will no longer appear in your feed. You can undo this any time on the Unfollowed page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-meta text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant="gel" disabled={busy} onClick={confirm}>
            {busy ? "Unfollowing…" : "Unfollow"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

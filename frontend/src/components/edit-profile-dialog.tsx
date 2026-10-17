"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage, isApiError } from "@/lib/api";
import { qk, updatePosts } from "@/lib/cache";
import { BIO_MAX, DISPLAY_NAME_MAX } from "@/lib/constants";
import type { Me, Profile, User } from "@/lib/types";

export function EditProfileDialog({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription className="text-meta text-muted-foreground">
            Everything you post is public.
          </DialogDescription>
        </DialogHeader>
        {open ? <EditProfileForm user={user} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditProfileForm({ user, onDone }: { user: User; onDone: () => void }) {
  const qc = useQueryClient();
  const ids = useId();
  const [displayName, setDisplayName] = useState(user.display_name);
  const [bio, setBio] = useState(user.bio);
  const mutation = useMutation({
    mutationFn: () => api.updateMe({ display_name: displayName.trim(), bio: bio.trim() }),
    onSuccess: ({ user: me }) => {
      qc.setQueryData<{ user: Me }>(qk.me, { user: me });
      qc.setQueryData<Profile>(qk.user(me.username), (profile) =>
        profile && { ...profile, user: { ...profile.user, display_name: me.display_name, bio: me.bio } },
      );
      updatePosts(
        qc,
        (p) => p.author.id === me.id,
        (p) => ({ ...p, author: { ...p.author, display_name: me.display_name } }),
      );
      onDone();
    },
  });
  const fields = isApiError(mutation.error, "validation_error") ? mutation.error.fields ?? {} : {};

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-name`}>Display name</Label>
        <Input
          id={`${ids}-name`}
          value={displayName}
          maxLength={DISPLAY_NAME_MAX}
          onChange={(e) => setDisplayName(e.target.value)}
          aria-invalid={Boolean(fields.display_name) || undefined}
          aria-describedby={fields.display_name ? `${ids}-name-error` : undefined}
        />
        {fields.display_name ? (
          <p id={`${ids}-name-error`} className="text-meta text-destructive">
            {fields.display_name}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${ids}-bio`}>Bio</Label>
        <Textarea
          id={`${ids}-bio`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="max-h-40 min-h-20 resize-none"
          aria-invalid={Boolean(fields.bio) || undefined}
          aria-describedby={`${ids}-bio-count${fields.bio ? ` ${ids}-bio-error` : ""}`}
        />
        <div className="flex justify-between gap-2">
          {fields.bio ? (
            <p id={`${ids}-bio-error`} className="text-meta text-destructive">
              {fields.bio}
            </p>
          ) : (
            <span />
          )}
          <span id={`${ids}-bio-count`} className="text-meta text-muted-foreground tabular-nums">
            {Array.from(bio.trim()).length}/{BIO_MAX}
          </span>
        </div>
      </div>
      {mutation.isError && Object.keys(fields).length === 0 ? (
        <p role="alert" className="text-meta text-destructive">
          {errorMessage(mutation.error, "Couldn't save. Try again.")}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="gel" disabled={mutation.isPending || displayName.trim().length === 0}>
          {mutation.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

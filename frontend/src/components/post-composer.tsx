"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TopicPicker } from "@/components/topic-picker";
import { UserAvatar } from "@/components/user-avatar";
import { useMe } from "@/hooks/queries";
import { useHydrated } from "@/hooks/use-hydrated";
import { api, isApiError } from "@/lib/api";
import { qk } from "@/lib/cache";
import { POST_COUNTER_FROM, POST_MAX } from "@/lib/constants";
import type { Post, TopicSlug } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Code points, like the API's length check (emoji count once). */
function charCount(text: string) {
  return Array.from(text.trim()).length;
}

function counterAnnouncement(count: number) {
  if (count > POST_MAX) return "Over the character limit.";
  if (count === POST_MAX) return "Character limit reached.";
  if (count >= 450) return "Nearly at the character limit.";
  return "";
}

interface PostComposerProps {
  /** `inline` sits at the top of the feed sheet; `sheet` is the mobile Drawer with Post top right. */
  layout?: "inline" | "sheet";
  onPosted?: (post: Post) => void;
  onCancel?: () => void;
  /** Lets the shell's "Write a post" focus this composer. */
  registerFocus?: (focus: (() => void) | null) => void;
}

export function PostComposer({ layout = "inline", onPosted, onCancel, registerFocus }: PostComposerProps) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  // The shell may have loaded /me before this page hydrates: render the placeholder first.
  const hydrated = useHydrated();
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<TopicSlug | "">("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ids = useId();

  useEffect(() => {
    if (!registerFocus) return;
    registerFocus(() => {
      textareaRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      textareaRef.current?.focus({ preventScroll: true });
    });
    return () => registerFocus(null);
  }, [registerFocus]);

  const mutation = useMutation({
    mutationFn: (input: { body: string; topic: TopicSlug }) => api.createPost(input),
    onSuccess: (post) => {
      qc.setQueryData<Post[]>(qk.pinned, (list = []) => [post, ...list]);
      qc.invalidateQueries({ queryKey: qk.userPosts(post.author.username) });
      setBody("");
      setTopic("");
      toast.success("Posted. It's pinned at the top of your feed for now.");
      onPosted?.(post);
    },
  });

  const count = charCount(body);
  const over = count - POST_MAX;
  const canPost = count > 0 && topic !== "" && over <= 0 && !mutation.isPending;
  const showTopicHint = count > 0 && topic === "";
  const fields = isApiError(mutation.error, "validation_error") ? mutation.error.fields : undefined;
  const rateLimited = isApiError(mutation.error, "rate_limited") ? mutation.error.message : undefined;

  const submit = () => {
    if (canPost) mutation.mutate({ body: body.trim(), topic: topic as TopicSlug });
  };

  const postButton = (
    <Button type="submit" variant="gel" disabled={!canPost} className="min-w-20">
      {mutation.isPending ? "Posting…" : "Post"}
    </Button>
  );

  const counter =
    count >= POST_COUNTER_FROM ? (
      <span
        className={cn("text-meta tabular-nums", over > 0 ? "font-semibold text-destructive" : "text-muted-foreground")}
      >
        {over > 0 ? `${over} characters over the limit` : `${count}/${POST_MAX}`}
      </span>
    ) : null;

  return (
    <form
      noValidate
      aria-label="Write a post"
      className={cn(layout === "inline" && "px-4 py-4 lg:px-5", layout === "sheet" && "px-4 pb-4")}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {layout === "sheet" ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {postButton}
        </div>
      ) : null}

      <div className="flex gap-3">
        {hydrated && me ? (
          <UserAvatar user={me} size={40} className="shrink-0" />
        ) : (
          <span className="size-10 shrink-0 rounded-full bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textareaRef}
            aria-label="Post text"
            placeholder="Write something for everyone"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            aria-invalid={over > 0 || Boolean(fields?.body) || undefined}
            aria-describedby={`${ids}-helper`}
            className="max-h-[226px] min-h-[94px] resize-none overflow-y-auto text-post"
          />

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <TopicPicker
              value={topic}
              onChange={setTopic}
              invalid={Boolean(fields?.topic)}
              describedBy={showTopicHint ? `${ids}-hint` : undefined}
            />
            <span id={`${ids}-helper`} className="text-meta text-muted-foreground">
              Posts are public.
            </span>
            <span className="ml-auto flex items-center gap-3">
              {counter}
              {layout === "sheet" ? null : postButton}
            </span>
          </div>
          {layout === "sheet" && counter ? <div className="mt-2 text-right">{counter}</div> : null}

          {showTopicHint ? (
            <p id={`${ids}-hint`} className="mt-2 text-meta text-muted-foreground">
              Pick a topic to post.
            </p>
          ) : null}
          <span aria-live="polite" className="sr-only">
            {counterAnnouncement(count)}
          </span>

          {mutation.isError ? (
            <Alert variant="destructive" className="mt-3">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Couldn&apos;t post. Your text is still here, so try again.</AlertTitle>
              {fields || rateLimited ? (
                <AlertDescription className="text-meta text-destructive">
                  {rateLimited ?? Object.values(fields ?? {}).join(" ")}
                </AlertDescription>
              ) : null}
            </Alert>
          ) : null}
        </div>
      </div>
    </form>
  );
}

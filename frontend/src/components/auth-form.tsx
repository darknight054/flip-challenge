"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassOrb } from "@/components/wordmark";
import { ApiError, api } from "@/lib/api";

type Mode = "login" | "register";

/** Only same-site paths are allowed as a post-login destination. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const COPY = {
  login: { title: "Log in", submit: "Log in", switchText: "New here?", switchLink: "Create an account", switchHref: "/register" },
  register: {
    title: "Create an account",
    submit: "Create account",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
} as const;

/** Username and password only (Q26). A centred glass card over the full backdrop. */
export function AuthForm({ mode }: { mode: Mode }) {
  const ids = useId();
  const copy = COPY[mode];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      mode === "login" ? api.login(input) : api.register(input),
    // A full load so the proxy, the shell and every cache start from the new session.
    onSuccess: () => window.location.replace(nextPath()),
  });

  const error = mutation.error instanceof ApiError ? mutation.error : null;
  const fields: Record<string, string> = { ...(error?.fields ?? {}) };
  if (error?.code === "username_taken") fields.username = "That username is taken.";

  let formAlert: string | null = null;
  if (error?.code === "invalid_credentials") formAlert = "That username and password don't match.";
  else if (error && !error.fields && error.code !== "username_taken") formAlert = error.message;
  else if (mutation.isError && !error) formAlert = "Couldn't reach Serendipity. Check your connection and try again.";

  const describedBy = (field: string, ...extra: string[]) =>
    [fields[field] ? `${ids}-${field}-error` : null, ...extra].filter(Boolean).join(" ") || undefined;

  return (
    <div className="glass w-full max-w-[400px] rounded-lg px-6 py-8 sm:px-8">
      <p className="flex items-center justify-center gap-2 text-title font-bold">
        <GlassOrb />
        <span className="wordmark">Serendipity</span>
      </p>
      <h1 className="mt-6 text-title font-bold">{copy.title}</h1>
      <p className="mt-1 text-ui text-muted-foreground">Everyone starts connected. You decide what disappears.</p>

      <form
        noValidate
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ username: username.trim(), password });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-username`}>Username</Label>
          <Input
            id={`${ids}-username`}
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={Boolean(fields.username) || undefined}
            aria-describedby={describedBy("username")}
          />
          {fields.username ? (
            <p id={`${ids}-username-error`} className="text-meta text-destructive">
              {fields.username}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${ids}-password`}>Password</Label>
          <div className="relative">
            <Input
              id={`${ids}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
              aria-invalid={Boolean(fields.password) || undefined}
              aria-describedby={describedBy("password", ...(mode === "register" ? [`${ids}-password-help`] : []))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-0.5 -translate-y-1/2 lg:right-1"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {fields.password ? (
            <p id={`${ids}-password-error`} className="text-meta text-destructive">
              {fields.password}
            </p>
          ) : null}
          {mode === "register" ? (
            <p id={`${ids}-password-help`} className="text-meta text-muted-foreground">
              There&apos;s no password reset yet, so keep it somewhere safe.
            </p>
          ) : null}
        </div>

        {mode === "register" ? <p className="text-meta text-muted-foreground">Everything you post is public.</p> : null}

        {formAlert ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="text-destructive">{formAlert}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" variant="gel" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {copy.submit}
        </Button>
      </form>

      <p className="mt-6 text-center text-ui text-muted-foreground">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-semibold text-primary underline-offset-4 hover:underline">
          {copy.switchLink}
        </Link>
      </p>
    </div>
  );
}

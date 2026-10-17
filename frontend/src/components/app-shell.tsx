"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CircleHelp, Ellipsis, House, LogOut, Plus, User, UserMinus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposerProvider, useComposer } from "@/components/composer-provider";
import { ReasonPill } from "@/components/feed-reason-badge";
import { RecipeBar } from "@/components/recipe-bar";
import { UserAvatar } from "@/components/user-avatar";
import { Wordmark } from "@/components/wordmark";
import { useMe, useRecipe } from "@/hooks/queries";
import { useHydrated } from "@/hooks/use-hydrated";
import { api } from "@/lib/api";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string | null;
  icon: LucideIcon;
}

function useNavItems(): NavItem[] {
  const { data: me } = useMe();
  // The links hydrate inside a Suspense boundary, possibly after /me resolved: match the server first.
  const hydrated = useHydrated();
  return [
    { label: "Feed", href: "/", icon: House },
    { label: "Profile", href: hydrated && me ? `/u/${me.username}` : null, icon: User },
    { label: "Unfollowed", href: "/settings/unfollowed", icon: UserMinus },
    { label: "How it works", href: "/algorithm", icon: CircleHelp },
  ];
}

async function logOut() {
  try {
    await api.logout();
  } catch {
    toast.error("Couldn't log out. Try again.");
    return;
  }
  // A full load resets every cache and preserved route.
  window.location.replace("/login");
}

// ---- Desktop left nav ----

function SideNavLinks({ pathname }: { pathname: string | null }) {
  const items = useNavItems();
  return (
    <ul className="mt-6 space-y-1">
      {items.map(({ label, href, icon: Icon }) => {
        const active = href !== null && pathname === href;
        return (
          <li key={label}>
            <Link
              href={href ?? "/"}
              aria-current={active ? "page" : undefined}
              aria-disabled={href === null || undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-md px-3 text-ui transition-colors duration-150 hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none",
                active ? "bg-white/60 font-semibold" : "text-foreground/85",
              )}
            >
              {active ? (
                <span aria-hidden="true" className="gel absolute top-2 bottom-2 left-0 w-1.5 rounded-full" />
              ) : null}
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveSideNavLinks() {
  return <SideNavLinks pathname={usePathname()} />;
}

function AccountRow() {
  const { data: me } = useMe();
  if (!me) return <div className="h-14" />;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <UserAvatar user={me} size={36} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{me.display_name}</span>
            <span className="block truncate text-meta text-muted-foreground">@{me.username}</span>
          </span>
          <Ellipsis aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="sr-only">Account menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        <DropdownMenuItem onSelect={logOut}>
          <LogOut aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SideNav() {
  const { openComposer } = useComposer();
  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <nav aria-label="Main" className="glass sticky top-6 flex h-[calc(100dvh-48px)] flex-col rounded-lg p-4">
        <Wordmark className="px-2 py-1" />
        <Suspense fallback={<SideNavLinks pathname={null} />}>
          <ActiveSideNavLinks />
        </Suspense>
        <Button variant="gel" size="lg" className="mt-5 w-full" onClick={openComposer}>
          Write a post
        </Button>
        <div className="mt-auto border-t border-divider pt-3">
          <AccountRow />
        </div>
      </nav>
    </aside>
  );
}

// ---- Right panel (from 1280px): today's recipe and nothing else ----

function RightPanel() {
  const recipe = useRecipe();
  return (
    <aside className="hidden w-[300px] shrink-0 xl:block" aria-labelledby="recipe-title">
      <div className="glass sticky top-6 rounded-lg p-5">
        <h2 id="recipe-title" className="text-heading font-semibold">
          Today&apos;s recipe
        </h2>
        {recipe.data ? (
          <>
            <RecipeBar pools={recipe.data.pools} className="mt-3" />
            <ul className="mt-4 space-y-2">
              {recipe.data.pools.map((pool) => (
                <li key={pool.code} className="flex items-center justify-between gap-2">
                  <ReasonPill code={pool.code} />
                  <span className="text-ui font-semibold tabular-nums">{percent(pool.share)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="sheen mt-3 h-32 rounded-md" />
        )}
        <Link
          href="/algorithm"
          className="mt-5 inline-flex items-center gap-1 rounded-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          How this works
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

// ---- Mobile top bar and bottom nav (below 1024px) ----

function MobileTopBar() {
  const { data: me } = useMe();
  return (
    <header className="glass fixed inset-x-0 top-0 z-40 rounded-none border-x-0 border-t-0 pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Wordmark className="text-heading" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-foreground" asChild>
            <Link href="/algorithm" aria-label="How it works">
              <CircleHelp aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          {me ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="flex size-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <UserAvatar user={me} size={32} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href={`/u/${me.username}`}>
                    <User aria-hidden="true" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logOut}>
                  <LogOut aria-hidden="true" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="size-11" />
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNavLinks({ pathname }: { pathname: string | null }) {
  const { openComposer } = useComposer();
  const [feed, profile, unfollowed] = useNavItems();
  const link = ({ label, href, icon: Icon }: NavItem) => {
    const active = href !== null && pathname === href;
    return (
      <li key={label} className="flex justify-center">
        <Link
          href={href ?? "/"}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[12px] leading-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            active ? "font-semibold text-primary" : "text-muted-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
          {label}
        </Link>
      </li>
    );
  };
  return (
    <ul className="mx-auto grid h-16 max-w-md grid-cols-4 items-center">
      {link(feed)}
      <li className="flex justify-center">
        <button
          type="button"
          aria-label="Write a post"
          onClick={openComposer}
          className="gel flex size-12 items-center justify-center rounded-full transition-transform duration-150 active:translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none"
        >
          <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
        </button>
      </li>
      {link(unfollowed)}
      {link(profile)}
    </ul>
  );
}

function ActiveBottomNavLinks() {
  return <BottomNavLinks pathname={usePathname()} />;
}

function MobileBottomNav() {
  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <Suspense fallback={<BottomNavLinks pathname={null} />}>
        <ActiveBottomNavLinks />
      </Suspense>
    </nav>
  );
}

/** Left nav (from 1024), feed column (max 600), right panel (from 1280); top + bottom bars below 1024. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ComposerProvider>
      <MobileTopBar />
      <div className="mx-auto flex w-full max-w-[1236px] justify-center gap-6 pt-[calc(56px+env(safe-area-inset-top))] pb-[calc(80px+env(safe-area-inset-bottom))] sm:px-4 lg:px-6 lg:py-6">
        <SideNav />
        <main className="w-full max-w-[600px] min-w-0 sm:pt-4 lg:flex-1 lg:pt-0">{children}</main>
        <RightPanel />
      </div>
      <MobileBottomNav />
    </ComposerProvider>
  );
}

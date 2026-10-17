"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";

const VISIBLE_RATIO = 0.5;
const DWELL_MS = 1000;
const FLUSH_MS = 5000;
const BATCH_MAX = 50;

/** Posts already counted during this page load (dedupe per post, Q20). */
const counted = new Set<number>();

interface Target {
  sessionId: string;
  postId: number;
  position: number;
}

type Pending = Map<string, { post_id: number; position: number }[]>;

/**
 * Home-feed impressions: a post counts once it has been >=50% visible for >=1 s. Impressions
 * are batched (<=50 per request) and flushed every ~5 s and when the page is hidden.
 * Returns a stable `observe(el, target)` that returns its own cleanup.
 */
export function useImpressions() {
  const targets = useRef(new Map<Element, Target>());
  const timers = useRef(new Map<Element, number>());
  const pending = useRef<Pending>(new Map());
  const observer = useRef<IntersectionObserver | null>(null);

  const flush = useCallback((keepalive: boolean) => {
    const batches = pending.current;
    pending.current = new Map();
    for (const [sessionId, items] of batches) {
      for (let i = 0; i < items.length; i += BATCH_MAX) {
        api
          .impressions({ session_id: sessionId, items: items.slice(i, i + BATCH_MAX) }, keepalive)
          .catch(() => {
            // Best effort: a lost impression only means the post may be served again later.
          });
      }
    }
  }, []);

  const stopTimer = useCallback((el: Element) => {
    const timer = timers.current.get(el);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(el);
  }, []);

  useEffect(() => {
    const elements = targets.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = elements.get(entry.target);
          if (!target || counted.has(target.postId)) continue;
          // Very tall posts can never reach 50%; count them once they fill half the viewport.
          const fillsHalf =
            entry.rootBounds !== null && entry.intersectionRect.height >= entry.rootBounds.height * VISIBLE_RATIO;
          const visible = entry.isIntersecting && (entry.intersectionRatio >= VISIBLE_RATIO || fillsHalf);

          if (!visible) {
            stopTimer(entry.target);
          } else if (!timers.current.has(entry.target)) {
            const el = entry.target;
            const timer = window.setTimeout(() => {
              timers.current.delete(el);
              if (counted.has(target.postId) || document.visibilityState !== "visible") return;
              counted.add(target.postId);
              const list = pending.current.get(target.sessionId) ?? [];
              list.push({ post_id: target.postId, position: target.position });
              pending.current.set(target.sessionId, list);
            }, DWELL_MS);
            timers.current.set(el, timer);
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    observer.current = io;
    elements.forEach((_target, el) => io.observe(el));

    const interval = window.setInterval(() => flush(false), FLUSH_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timerMap = timers.current;

    return () => {
      io.disconnect();
      observer.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      timerMap.forEach((timer) => window.clearTimeout(timer));
      timerMap.clear();
      flush(true);
    };
  }, [flush, stopTimer]);

  return useCallback(
    (el: Element, target: Target) => {
      targets.current.set(el, target);
      observer.current?.observe(el);
      return () => {
        observer.current?.unobserve(el);
        stopTimer(el);
        targets.current.delete(el);
      };
    },
    [stopTimer],
  );
}

export type ObserveImpression = ReturnType<typeof useImpressions>;

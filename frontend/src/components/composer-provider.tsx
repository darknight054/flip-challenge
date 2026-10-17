"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PostComposer } from "@/components/post-composer";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/use-media-query";

interface ComposerContextValue {
  /** Focus the inline composer on the desktop feed, otherwise open it in a Drawer/Dialog. */
  openComposer: () => void;
  registerInline: (focus: (() => void) | null) => void;
}

const ComposerContext = createContext<ComposerContextValue | null>(null);

export function useComposer() {
  const value = useContext(ComposerContext);
  if (!value) throw new Error("useComposer must be used inside <ComposerProvider>");
  return value;
}

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const inlineFocus = useRef<(() => void) | null>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const registerInline = useCallback((focus: (() => void) | null) => {
    inlineFocus.current = focus;
  }, []);

  const openComposer = useCallback(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches && inlineFocus.current) {
      inlineFocus.current();
      return;
    }
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openComposer, registerInline }), [openComposer, registerInline]);
  const close = () => setOpen(false);

  return (
    <ComposerContext.Provider value={value}>
      {children}
      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="p-0 sm:max-w-xl" showCloseButton={false}>
            <DialogTitle className="sr-only">Write a post</DialogTitle>
            <PostComposer layout="inline" onPosted={close} />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
            <DrawerTitle className="sr-only">Write a post</DrawerTitle>
            <div className="pt-3">
              <PostComposer layout="sheet" onPosted={close} onCancel={close} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </ComposerContext.Provider>
  );
}

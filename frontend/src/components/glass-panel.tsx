"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One glass sheet: edge to edge on phones, a rounded panel from `sm`. */
export function GlassPanel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("glass max-sm:rounded-none max-sm:border-x-0 sm:rounded-lg", className)}
      {...props}
    />
  );
}

export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 text-foreground"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
    >
      <ArrowLeft aria-hidden="true" />
      Back
    </Button>
  );
}

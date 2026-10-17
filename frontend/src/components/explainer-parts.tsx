import { Button } from "@/components/ui/button";

/** A titled block of the "How it works" page. */
export function Section({
  title,
  intro,
  children,
  id,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-divider px-4 py-5 lg:px-5">
      <h2 id={id} className="text-heading font-semibold">
        {title}
      </h2>
      {intro ? <p className="mt-1 text-ui text-muted-foreground">{intro}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-ui text-muted-foreground">Couldn&apos;t load this.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

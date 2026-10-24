"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Last-resort fallback for anything a page didn't handle itself. Model call
// failures are handled on the claim, so this should rarely show.
export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="screen-line-bottom px-4 py-16 sm:px-8">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tighter">
          Something went wrong.
        </h1>
        <p className="text-muted-foreground">
          Nothing was lost: claims and rulings are saved as they happen. Try
          again, and if it keeps failing, check the server log.
        </p>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </section>
  );
}

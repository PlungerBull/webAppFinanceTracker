"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 🛡️ CTO Mandate: Capture the error with technical metadata
    Sentry.captureException(error, {
      tags: { 
        layer: "global_boundary",
        digest: error.digest 
      },
    });
  }, [error]);

  return (
    <html>
      <body className="flex h-screen flex-col items-center justify-center space-y-4 bg-background text-foreground">
        <h2 className="text-2xl font-bold italic tracking-tight">Something went critically wrong.</h2>
        <p className="text-muted-foreground">The incident has been reported to the engineering team.</p>
        <Button 
          variant="outline" 
          onClick={() => reset()}
        >
          Attempt Recovery
        </Button>
      </body>
    </html>
  );
}
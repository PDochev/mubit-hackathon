"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// A form submit button that shows a spinner while its server action runs.
export function SubmitButton({
  children,
  pending,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pending: ReactNode }) {
  const status = useFormStatus();
  return (
    <Button type="submit" disabled={status.pending} {...props}>
      {status.pending && <Spinner data-icon="inline-start" />}
      {status.pending ? pending : children}
    </Button>
  );
}

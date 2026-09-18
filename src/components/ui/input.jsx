import React from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none resize-none focus-visible:ring-2 focus-visible:ring-teal",
        className
      )}
      {...props}
    />
  );
}

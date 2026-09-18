import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", {
  variants: {
    tone: {
      neutral: "bg-bg text-muted border-border",
      teal: "bg-teal/10 text-teal-dark border-teal/30",
      amber: "bg-amber/10 text-amber border-amber/30",
      danger: "bg-danger/10 text-danger border-danger/30",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

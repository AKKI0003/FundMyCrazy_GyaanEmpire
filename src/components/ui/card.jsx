import React from "react";
import { cn } from "../../lib/utils";

export function Card({ className, ...props }) {
  return <div className={cn("bg-surface border border-border rounded-lg", className)} {...props} />;
}

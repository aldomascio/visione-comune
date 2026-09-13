import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

type BadgeVariant = "primary" | "secondary" | "outline" | "muted";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
  muted: "bg-muted text-muted-foreground"
};

export function Badge({ className, variant = "primary", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

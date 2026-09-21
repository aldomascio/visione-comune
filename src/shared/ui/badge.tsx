import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

type BadgeVariant = "primary" | "secondary" | "outline" | "muted" | "success" | "warning" | "danger" | "info";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

const variantClasses: Record<BadgeVariant, string> = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-border text-foreground",
  muted: "bg-muted text-muted-foreground",
  success: "border border-success/20 bg-success/10 text-success",
  warning: "border border-warning/20 bg-warning/10 text-warning",
  danger: "border border-destructive/20 bg-destructive/10 text-destructive",
  info: "border border-info/20 bg-info/10 text-info"
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

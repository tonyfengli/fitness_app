import * as React from "react";
import { cva } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "../../utils/cn";
import type { ButtonProps } from "./Button.types";

/**
 * Theme-aware Button component
 * Uses CSS variables for easy theme switching
 */

export const buttonThemeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[--button-primary-bg] text-[--button-primary-text] shadow hover:bg-[--button-primary-hover]",
        secondary:
          "bg-[--button-secondary-bg] text-[--button-secondary-text] shadow-sm hover:bg-[--button-secondary-hover]",
        outline:
          "border border-[--color-border] bg-transparent shadow-sm hover:bg-[--color-surface-hover] hover:text-[--color-text]",
        ghost: 
          "hover:bg-[--color-surface-hover] hover:text-[--color-text]",
        link: 
          "text-[--color-primary] underline-offset-4 hover:underline",
        destructive:
          "bg-[--color-error] text-white shadow-sm hover:bg-[--color-error]/90",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function ThemedButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Slot : "button";
  return (
    <Comp
      className={cn(buttonThemeVariants({ variant, size, className }))}
      {...props}
    />
  );
}
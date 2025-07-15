import type { VariantProps } from "class-variance-authority";
import type React from "react";
import type { buttonVariants } from "./Button";

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
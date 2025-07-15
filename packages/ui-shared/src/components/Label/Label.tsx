import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";
import { cn } from "../../utils/cn";
import type { LabelProps } from "./Label.types";

export function Label({ className, ...props }: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
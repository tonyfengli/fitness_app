import type React from "react";
import type { FieldPath, FieldValues } from "react-hook-form";
import type { Slot } from "radix-ui";
import type { Label } from "../Label";

export interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

export interface FormItemContextValue {
  id: string;
}

export interface FormItemProps extends React.ComponentProps<"div"> {}

export interface FormLabelProps extends React.ComponentProps<typeof Label> {}

export interface FormControlProps extends React.ComponentProps<typeof Slot.Slot> {}

export interface FormDescriptionProps extends React.ComponentProps<"p"> {}

export interface FormMessageProps extends React.ComponentProps<"p"> {}
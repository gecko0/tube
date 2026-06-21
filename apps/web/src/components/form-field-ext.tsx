import type { ReactElement } from "react"
import type {
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  UseControllerProps,
  UseFormStateReturn,
} from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"

export interface FormFieldExtProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends UseControllerProps<TFieldValues, TName> {
  className?: string
  labelClassName?: string
  label?: string
  description?: string
  render: ({
    field,
    fieldState,
    formState,
  }: {
    field: ControllerRenderProps<TFieldValues, TName>
    fieldState: ControllerFieldState
    formState: UseFormStateReturn<TFieldValues>
  }) => ReactElement
}

export function FormFieldExt<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  labelClassName,
  control,
  name,
  label,
  description,
  render,
  ...props
}: FormFieldExtProps<TFieldValues, TName>) {
  return (
    <FormField<TFieldValues, TName>
      control={control}
      name={name}
      render={({ field, fieldState, formState }) => (
        <FormItem className={cn("gap-2", className)}>
          {label && <FormLabel className={labelClassName}>{label}</FormLabel>}
          <FormControl>{render({ field, fieldState, formState })}</FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
      {...props}
    />
  )
}

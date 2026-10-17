import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Aero buttons: pill shaped, focus ring with a 2px white offset so it reads over the sky,
// and the gel press (1px down, inner shadow). Touch targets are >=44px below `lg`.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-ui whitespace-nowrap transition-[background-color,box-shadow,transform,filter,color] duration-150 ease-out outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
        gel: "gel font-semibold hover:brightness-[1.06] active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.25)] disabled:saturate-50",
        outline:
          "border-input/50 bg-white/75 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(14_42_71/0.12)] hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary",
        ghost:
          "text-muted-foreground hover:bg-secondary/80 hover:text-foreground aria-expanded:bg-secondary aria-expanded:text-foreground",
        destructive:
          "bg-destructive font-semibold text-white hover:bg-destructive/90",
        link: "rounded-md text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5 lg:h-9 lg:px-4",
        xs: "h-7 gap-1 px-2 text-meta [&_svg:not([class*='size-'])]:size-3",
        sm: "h-11 gap-1.5 px-3 lg:h-8 lg:px-3 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-6 text-heading",
        icon: "size-11 lg:size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-11 lg:size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

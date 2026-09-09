import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight, Circle, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownMenuOption {
  label: string;
  onClick?: () => void;
  Icon?: React.ReactNode;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

export interface DropdownMenuProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root> {
  options?: DropdownMenuOption[];
  triggerClassName?: string;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-xl px-2.5 py-1.5 text-xs outline-none transition-colors data-[state=open]:bg-amber-500/10 data-[state=open]:text-amber-600 focus:bg-amber-500/10 focus:text-amber-600",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-2xl border border-amber-950/10 dark:border-[#2C221D] bg-white/95 dark:bg-[#181412]/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-xl shadow-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] max-h-[var(--radix-dropdown-menu-content-available-height,24rem)] overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] pointer-events-auto rounded-2xl border border-amber-950/10 dark:border-[#2C221D] bg-white/95 dark:bg-[#181412]/95 backdrop-blur-xl p-1.5 text-popover-foreground shadow-xl shadow-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: 'default' | 'destructive';
  }
>(({ className, inset, variant = 'default', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      variant === 'destructive'
        ? "text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/20 focus:bg-destructive/10 focus:text-destructive"
        : "text-stone-700 dark:text-stone-300 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 focus:bg-amber-500/10 focus:text-amber-600 dark:focus:text-amber-400",
      inset && "pl-8",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-xl py-1.5 pl-8 pr-2.5 text-xs outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-amber-500/10 hover:text-amber-600 focus:bg-amber-500/10 focus:text-amber-600",
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-amber-500" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-xl py-1.5 pl-8 pr-2.5 text-xs outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-amber-500/10 hover:text-amber-600 focus:bg-amber-500/10 focus:text-amber-600",
      className,
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current text-amber-500" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2.5 py-1.5 text-xs font-semibold text-muted-foreground", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-stone-200/60 dark:bg-[#2C221D]/80", className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn("ml-auto text-[10px] tracking-widest opacity-60", className)} {...props} />;
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

/**
 * 🐻☕ Bear Cafe DropdownMenu
 * รองรับทั้งสองรูปแบบ:
 * 1. Simple Options API: `<DropdownMenu options={options}>ตัวเลือก</DropdownMenu>`
 * 2. Standard Radix Compound: `<DropdownMenu><DropdownMenuTrigger>...</DropdownMenuTrigger><DropdownMenuContent>...</DropdownMenuContent></DropdownMenu>`
 */
const DropdownMenu: React.FC<DropdownMenuProps> = ({
  options,
  children,
  triggerClassName,
  contentClassName,
  align = 'end',
  ...rootProps
}) => {
  if (options && Array.isArray(options)) {
    return (
      <DropdownMenuPrimitive.Root {...rootProps}>
        <DropdownMenuTrigger asChild>
          {typeof children === 'string' || !children ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold select-none transition-all",
                "bg-stone-500/10 hover:bg-amber-500/15 text-stone-700 dark:text-stone-300 hover:text-amber-600 dark:hover:text-amber-400",
                "border border-stone-200/80 dark:border-[#2C221D] hover:border-amber-500/30",
                "shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20",
                triggerClassName
              )}
            >
              {children || <MoreHorizontal className="h-4 w-4" />}
            </button>
          ) : (
            children
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          className={cn("min-w-[140px] p-1 space-y-0.5", contentClassName)}
        >
          {options.map((opt, i) => (
            <DropdownMenuItem
              key={i}
              disabled={opt.disabled}
              variant={opt.variant}
              onClick={opt.onClick}
              className="gap-2.5 py-2 px-2.5 text-xs font-medium"
            >
              {opt.Icon && <span className="shrink-0 opacity-80">{opt.Icon}</span>}
              <span className="truncate">{opt.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPrimitive.Root>
    );
  }

  return <DropdownMenuPrimitive.Root {...rootProps}>{children}</DropdownMenuPrimitive.Root>;
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};

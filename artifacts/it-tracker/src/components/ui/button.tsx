import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "glass";
  size?: "sm" | "default" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 active:shadow-md",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border-2 border-border bg-transparent hover:border-primary/30 hover:bg-primary/5 text-foreground",
      ghost: "hover:bg-accent/10 hover:text-accent text-muted-foreground",
      destructive: "bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground",
      glass: "bg-white/50 backdrop-blur-sm border border-white/50 shadow-sm hover:bg-white/80 text-foreground",
    };

    const sizes = {
      default: "h-11 px-5 py-2 font-medium",
      sm: "h-9 px-4 text-sm font-medium",
      lg: "h-14 px-8 text-lg font-semibold rounded-xl",
      icon: "h-11 w-11 justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!isLoading && children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };

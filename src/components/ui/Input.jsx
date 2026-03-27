import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef(({ className, label, error, icon: Icon, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-neutral-400 mb-2 font-display">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-accent-500 transition-colors duration-200">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 text-sm bg-neutral-900 border border-neutral-800 rounded-lg",
            "text-neutral-100 placeholder-neutral-600",
            "focus:outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500/50",
            "transition-all duration-200",
            Icon && "pl-11",
            error && "border-red-500/50 focus:ring-red-500/30",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export default Input;

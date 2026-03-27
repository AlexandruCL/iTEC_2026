import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

const Input = forwardRef(({ className, label, error, icon: Icon, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-lg font-medium text-dark-200 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-3 text-lg bg-dark-800 border border-dark-600 rounded-lg",
            "text-white placeholder-dark-400",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
            "transition-all duration-200",
            Icon && "pl-10",
            error && "border-red-500 focus:ring-red-500",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-lg text-red-400">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";

export default Input;

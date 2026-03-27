import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-primary-500 hover:bg-primary-600 text-white",
  secondary: "bg-dark-700 hover:bg-dark-600 text-white border border-dark-600",
  ghost: "bg-transparent hover:bg-dark-800 text-dark-200",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  github: "bg-[#24292e] hover:bg-[#2f363d] text-white",
};

const sizes = {
  sm: "px-3 py-1.5 text-lg",
  md: "px-4 py-2 text-lg",
  lg: "px-6 py-3 text-lg",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  loading,
  icon: Icon,
  ...props
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98, y: disabled || loading ? 0 : 1 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : Icon ? (
        <Icon className="w-5 h-5" />
      ) : null}
      {children}
    </motion.button>
  );
}

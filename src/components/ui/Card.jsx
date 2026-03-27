import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function Card({ children, className, hover = true, ...props }) {
  const Component = hover ? motion.div : "div";
  const motionProps = hover
    ? {
        whileHover: { y: -2 },
        transition: { type: "spring", stiffness: 400, damping: 25 },
      }
    : {};

  return (
    <Component
      className={cn(
        "surface rounded-xl p-6 relative overflow-hidden",
        "transition-all duration-200",
        hover && "hover:border-neutral-700 hover:shadow-lg hover:shadow-neutral-950/50",
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}

import React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function Card({ children, className, hover = true, ...props }) {
  const Component = hover ? motion.div : "div";
  const motionProps = hover
    ? {
        whileHover: { y: -2, boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)" },
        transition: { duration: 0.2 },
      }
    : {};

  return (
    <Component
      className={cn(
        "bg-dark-800/50 backdrop-blur-sm border border-dark-700 rounded-xl p-6",
        "transition-colors duration-200",
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}

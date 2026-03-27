import React from "react";
import FadeIn from "@/components/ui/FadeIn";

export default function StickyScroll({ leftContent, rightItems = [] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
      {/* Left — sticky */}
      <div className="lg:sticky lg:top-32 lg:self-start">
        {leftContent}
      </div>

      {/* Right — scrolls */}
      <div className="space-y-8">
        {rightItems.map((item, i) => (
          <FadeIn key={i} delay={i * 0.1} direction="right">
            {item}
          </FadeIn>
        ))}
      </div>
    </div>
  );
}

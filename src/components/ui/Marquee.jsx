import React from "react";

const items = [
  "JavaScript", "TypeScript", "Python", "React", "Node.js",
  "HTML & CSS", "Go", "Rust", "Java", "C++",
  "Next.js", "Vue.js", "Svelte", "GraphQL", "Docker",
  "PostgreSQL", "MongoDB", "Redis", "Git", "REST APIs",
];

function MarqueeRow({ reverse = false }) {
  const doubled = [...items, ...items];

  return (
    <div className="flex overflow-hidden marquee-mask">
      <div
        className={`flex shrink-0 gap-4 py-2 ${
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        }`}
      >
        {doubled.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-800 bg-neutral-900/50 text-neutral-400 text-sm font-medium whitespace-nowrap select-none hover:text-accent-400 hover:border-accent-500/30 transition-colors duration-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent-500/60" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="space-y-4 w-full">
      <MarqueeRow />
      <MarqueeRow reverse />
    </div>
  );
}

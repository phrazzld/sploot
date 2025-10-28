"use client";

import { ChevronDown } from "lucide-react";

interface ScrollChevronProps {
  targetId: string;
}

export function ScrollChevron({ targetId }: ScrollChevronProps) {
  const handleScroll = () => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      onClick={handleScroll}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground hover:text-foreground transition-colors animate-bounce cursor-pointer"
      aria-label={`Scroll to ${targetId}`}
    >
      <ChevronDown className="w-8 h-8" strokeWidth={1.5} />
    </button>
  );
}

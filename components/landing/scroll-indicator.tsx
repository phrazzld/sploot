"use client";

import { ChevronDown } from "lucide-react";

export function ScrollIndicator() {
  const handleClick = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce
                 cursor-pointer hover:text-foreground transition-colors"
      aria-label="Scroll to content"
    >
      <ChevronDown className="h-6 w-6 text-muted-foreground" />
    </button>
  );
}

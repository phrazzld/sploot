"use client";

import { useEffect, useState } from "react";

export function CollectionGrid() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-3 w-64 md:w-72">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-lg border border-primary/20 bg-primary/5 transition-colors duration-200 hover:border-primary hover:bg-primary/10 opacity-0"
          style={{
            animation: prefersReducedMotion
              ? `cascadeIn 0.3s ease-out ${i * 0.1}s forwards`
              : `cascadeIn 0.3s ease-out ${i * 0.1}s forwards, cascadeLoop 3s ease-in-out ${1.5 + i * 0.1}s infinite`,
          }}
        />
      ))}

      <style jsx global>{`
        @keyframes cascadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes cascadeLoop {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0;
            transform: scale(0.95);
          }
        }
      `}</style>
    </div>
  );
}

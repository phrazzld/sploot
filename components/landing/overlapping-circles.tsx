"use client";

interface OverlappingCirclesProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function OverlappingCircles({
  size = 224,
  strokeWidth = 3,
  className = "",
}: OverlappingCirclesProps) {
  const radius = (size - strokeWidth * 2) / 3;
  const centerY = size / 2;
  const leftCx = size / 2 - radius / 2;
  const rightCx = size / 2 + radius / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`w-28 h-28 md:w-56 md:h-56 ${className}`}
      aria-label="Sploot logo: overlapping circles representing semantic search"
    >
      <circle
        cx={leftCx}
        cy={centerY}
        r={radius}
        className="stroke-primary"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={rightCx}
        cy={centerY}
        r={radius}
        className="stroke-primary"
        strokeWidth={strokeWidth}
        fill="none"
      />
    </svg>
  );
}

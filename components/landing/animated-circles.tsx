"use client";

export function AnimatedCircles() {
  const size = 300;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth * 2) / 3;
  const centerY = size / 2;
  const leftCx = size / 2 - radius / 2;
  const rightCx = size / 2 + radius / 2;

  return (
    <div className="flex flex-col items-center justify-center space-y-6">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="w-64 h-64 md:w-[300px] md:h-[300px]"
      >
        {/* Left circle - appears first */}
        <circle
          cx={leftCx}
          cy={centerY}
          r={radius}
          className="stroke-primary opacity-0 animate-[fadeIn_0.6s_ease-out_forwards]"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Right circle - appears second */}
        <circle
          cx={rightCx}
          cy={centerY}
          r={radius}
          className="stroke-primary opacity-0 animate-[fadeIn_0.6s_ease-out_0.6s_forwards]"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Intersection highlight - appears third with stronger glow */}
        <circle
          cx={size / 2}
          cy={centerY}
          r={radius / 3}
          className="fill-primary/20 opacity-0 animate-[fadeIn_0.6s_ease-out_1.2s_forwards]"
        />

        {/* Continuous pulse on intersection */}
        <circle
          cx={size / 2}
          cy={centerY}
          r={radius / 3}
          className="fill-primary/10 opacity-0 animate-[pulse_3s_ease-in-out_1.8s_infinite]"
        />
      </svg>

      {/* Labels - sequential reveal matching visual story */}
      <div className="flex items-center justify-center gap-12 md:gap-16 text-xs md:text-sm font-mono text-muted-foreground">
        <span className="opacity-0 animate-[fadeIn_0.6s_ease-out_0.2s_forwards]">
          queries
        </span>
        <span className="opacity-0 animate-[fadeIn_0.6s_ease-out_1.4s_forwards] text-primary">
          matches
        </span>
        <span className="opacity-0 animate-[fadeIn_0.6s_ease-out_0.8s_forwards]">
          images
        </span>
      </div>
    </div>
  );
}

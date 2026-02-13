"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SCORE_COLORS: Record<number, string> = {
  1: "var(--score-rank-1)",
  2: "var(--score-rank-2)",
  3: "var(--score-rank-3)",
  4: "var(--score-rank-4)",
  5: "var(--score-rank-5)",
  6: "var(--score-rank-6)",
  7: "var(--score-rank-7)",
  8: "var(--score-rank-8)",
  9: "var(--score-rank-9)",
  10: "var(--score-rank-10)",
};

const RANK_LABELS: Record<number, string> = {
  1: "Very Low",
  2: "Low",
  3: "Below Average",
  4: "Slightly Below Average",
  5: "Average",
  6: "Slightly Above Average",
  7: "Above Average",
  8: "High",
  9: "Very High",
  10: "Exceptional",
};

const SIZE_CLASSES = {
  sm: {
    number: "text-2xl",
    label: "text-xs",
    container: "gap-1",
  },
  md: {
    number: "text-5xl",
    label: "text-sm",
    container: "gap-2",
  },
  lg: {
    number: "text-[5rem]",
    label: "text-base",
    container: "gap-3",
  },
} as const;

interface ScoreDisplayProps {
  rank: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function ScoreDisplay({
  rank,
  size = "lg",
  animate = true,
  showLabel = true,
  className,
}: ScoreDisplayProps) {
  const [isVisible, setIsVisible] = React.useState(!animate);
  const clampedRank = Math.min(10, Math.max(1, Math.round(rank)));
  const color = SCORE_COLORS[clampedRank] ?? SCORE_COLORS[5];
  const label = RANK_LABELS[clampedRank] ?? "";
  const sizeConfig = SIZE_CLASSES[size];

  React.useEffect(() => {
    if (animate) {
      const timer = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [animate]);

  return (
    <div
      role="img"
      aria-label={`診断スコア: ${clampedRank}点（10点満点中）`}
      className={cn(
        "flex flex-col items-center",
        sizeConfig.container,
        className
      )}
    >
      <span
        className={cn(
          "font-heading font-bold leading-none tabular-nums transition-[opacity,transform] duration-200 ease-out",
          sizeConfig.number,
          animate && !isVisible && "opacity-0 scale-95",
          animate && isVisible && "opacity-100 scale-100"
        )}
        style={{ color }}
      >
        {clampedRank}
      </span>
      {showLabel && (
        <span
          className={cn(
            "text-[var(--text-secondary)] font-medium transition-opacity duration-200 ease-out",
            sizeConfig.label,
            animate && !isVisible && "opacity-0",
            animate && isVisible && "opacity-100"
          )}
          style={{ transitionDelay: animate ? "100ms" : "0ms" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

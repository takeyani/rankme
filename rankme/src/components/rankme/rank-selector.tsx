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

interface RankSelectorProps {
  value?: number;
  onChange: (rank: number) => void;
  disabled?: boolean;
  className?: string;
}

export function RankSelector({
  value,
  onChange,
  disabled = false,
  className,
}: RankSelectorProps) {
  const handleKeyDown = (e: React.KeyboardEvent, rank: number) => {
    if (disabled) return;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = rank < 10 ? rank + 1 : 1;
      onChange(next);
      const nextButton = (e.currentTarget.parentElement?.querySelector(
        `[data-rank="${next}"]`
      ) as HTMLElement);
      nextButton?.focus();
    }

    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = rank > 1 ? rank - 1 : 10;
      onChange(prev);
      const prevButton = (e.currentTarget.parentElement?.querySelector(
        `[data-rank="${prev}"]`
      ) as HTMLElement);
      prevButton?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="ランク選択"
      className={cn(
        "flex flex-wrap gap-1.5",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((rank) => {
        const isSelected = value === rank;
        const color = SCORE_COLORS[rank];

        return (
          <button
            key={rank}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`ランク ${rank}`}
            data-rank={rank}
            tabIndex={isSelected || (!value && rank === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(rank)}
            onKeyDown={(e) => handleKeyDown(e, rank)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-sm font-semibold tabular-nums transition-[color,background-color,transform] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
              isSelected
                ? "text-white shadow-[var(--shadow-sm)] scale-110"
                : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
            style={
              isSelected
                ? { backgroundColor: color }
                : undefined
            }
          >
            {rank}
          </button>
        );
      })}
    </div>
  );
}

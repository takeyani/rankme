import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
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

interface HistoryCardProps {
  id: string;
  rank: number;
  date: string;
  onClick?: () => void;
  className?: string;
}

export function HistoryCard({
  id,
  rank,
  date,
  onClick,
  className,
}: HistoryCardProps) {
  const clampedRank = Math.min(10, Math.max(1, Math.round(rank)));
  const color = SCORE_COLORS[clampedRank] ?? SCORE_COLORS[5];

  const cardContent = (
    <CardContent className="flex items-center gap-4 p-4">
      {/* Rank color indicator */}
      <div
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white font-heading font-bold text-lg tabular-nums"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {clampedRank}
      </div>

      {/* Info section */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] font-heading">
          ランク {clampedRank}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {date}
        </p>
      </div>

      {/* Chevron indicator */}
      {onClick && (
        <svg
          className="h-4 w-4 flex-shrink-0 text-[var(--text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </CardContent>
  );

  if (onClick) {
    return (
      <Card
        className={cn(
          "cursor-pointer transition-shadow duration-150 hover:shadow-[var(--shadow-md)]",
          className
        )}
        role="button"
        tabIndex={0}
        aria-label={`診断結果: ランク ${clampedRank}、${date}`}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {cardContent}
      </Card>
    );
  }

  return (
    <Card
      className={cn(className)}
      aria-label={`診断結果: ランク ${clampedRank}、${date}`}
    >
      {cardContent}
    </Card>
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ScoreDisplay } from "./score-display";
import { AdviceCard } from "./advice-card";
import { Button } from "@/components/ui/button";

interface AdviceItem {
  title: string;
  description: string;
}

interface DiagnosisReportProps {
  rank: number;
  advice: AdviceItem[];
  onRetry?: () => void;
  onViewHistory?: () => void;
  className?: string;
}

export function DiagnosisReport({
  rank,
  advice,
  onRetry,
  onViewHistory,
  className,
}: DiagnosisReportProps) {
  return (
    <article
      aria-label="診断レポート"
      className={cn("flex flex-col items-center gap-6 w-full max-w-2xl mx-auto", className)}
    >
      {/* P0: Disclaimer ABOVE the score */}
      <div role="note" className="w-full rounded-[var(--radius-md)] bg-[var(--muted)]/10 px-4 py-3">
        <p className="text-[1rem] leading-relaxed text-[var(--text-secondary)]">
          本判定は、選別済み画像データとの類似度および傾向分析に基づく客観的結果です。
        </p>
        <p className="text-[1rem] leading-relaxed text-[var(--text-secondary)]">
          個人の価値や魅力を断定するものではありません。
        </p>
      </div>

      {/* Score display */}
      <div className="py-4">
        <ScoreDisplay rank={rank} size="lg" animate showLabel />
      </div>

      {/* Improvement advice section */}
      {advice.length > 0 && (
        <section className="w-full" aria-label="改善アドバイス">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)] font-heading uppercase tracking-wider">
            改善アドバイス
          </h3>
          <div role="list" className="flex flex-col gap-3">
            {advice.map((item, index) => (
              <div role="listitem" key={index}>
                <AdviceCard
                  title={item.title}
                  description={item.description}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full sm:w-auto">
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="default"
            size="lg"
            className="w-full sm:w-auto"
            aria-label="もう一度診断する"
          >
            もう一度診断する
          </Button>
        )}
        {onViewHistory && (
          <Button
            onClick={onViewHistory}
            variant="link"
            className="w-full sm:w-auto"
          >
            履歴を見る
          </Button>
        )}
      </div>
    </article>
  );
}

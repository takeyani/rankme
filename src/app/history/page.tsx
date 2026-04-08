"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

interface HistoryItem {
  diagnosisId: string;
  rank: number;
  createdAt: string;
}

interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

interface HistoryResponse {
  items: HistoryItem[];
  pagination: Pagination;
}

// --- Score color utility ---

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

function getScoreColor(rank: number): string {
  return SCORE_COLORS[rank] ?? "var(--text-primary)";
}

// --- Date formatting ---

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${h}:${min}`;
}

// --- Loading Skeletons ---

function HistorySkeletons() {
  return (
    <div className="space-y-sm" aria-busy="true" aria-label="履歴を読み込み中">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

// --- History Card ---

function HistoryCard({ item }: { item: HistoryItem }) {
  return (
    <Link href={`/history/${item.diagnosisId}`}>
      <Card className="transition-colors duration-normal hover:border-[var(--accent)]/50">
        <CardContent className="flex items-center justify-between p-md">
          <div className="flex items-center gap-lg">
            {/* Rank Badge */}
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[var(--radius-score-display)] font-score text-h3 font-bold tabular-nums"
              style={{ color: getScoreColor(item.rank) }}
              aria-label={`ランク ${item.rank}`}
            >
              {item.rank}
            </div>

            {/* Date & Rank label */}
            <div>
              <p className="text-body-sm font-medium text-[var(--text-primary)]">
                ランク {item.rank} / 10
              </p>
              <p className="text-caption text-[var(--text-secondary)]">
                {formatDate(item.createdAt)}
              </p>
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight
            className="h-5 w-5 text-[var(--muted)]"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </CardContent>
      </Card>
    </Link>
  );
}

// --- Empty State ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-lg py-3xl text-center">
      <History
        className="h-16 w-16 text-[var(--muted)]"
        strokeWidth={1}
        aria-hidden="true"
      />
      <div className="space-y-sm">
        <p className="text-body-lg font-medium text-[var(--text-primary)]">
          まだ診断結果がありません
        </p>
        <p className="text-body-sm text-[var(--text-secondary)]">
          トップページから診断を開始してください
        </p>
      </div>
      <Link href="/">
        <Button variant="outline">トップページへ</Button>
      </Link>
    </div>
  );
}

// --- Main Page ---

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (cursor?: string) => {
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");

      const response = await fetch(`/api/history?${params.toString()}`);

      if (!response.ok) {
        throw new Error("履歴の取得に失敗しました");
      }

      const data: HistoryResponse = await response.json();
      return data;
    } catch (err) {
      throw err instanceof Error ? err : new Error("予期しないエラーが発生しました");
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchHistory();
        if (!cancelled) {
          setItems(data.items);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchHistory]);

  // Load more
  const handleLoadMore = useCallback(async () => {
    if (!pagination?.nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchHistory(pagination.nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加読み込みに失敗しました");
    } finally {
      setIsLoadingMore(false);
    }
  }, [pagination, isLoadingMore, fetchHistory]);

  return (
    <main className="min-h-dvh px-md py-2xl">
      <div className="mx-auto w-full max-w-2xl space-y-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            <Link
              href="/"
              className="flex items-center text-body-sm text-[var(--text-secondary)] transition-colors duration-fast hover:text-[var(--accent)]"
              aria-label="トップページへ戻る"
            >
              <ArrowLeft className="mr-xs h-4 w-4" strokeWidth={1.5} />
              トップ
            </Link>
          </div>
          {pagination && (
            <span className="text-caption text-[var(--text-secondary)]">
              全 {pagination.totalCount} 件
            </span>
          )}
        </div>

        <h1 className="font-heading text-h2 font-semibold text-[var(--text-primary)]">
          診断履歴
        </h1>

        {/* Content */}
        {isLoading ? (
          <HistorySkeletons />
        ) : error ? (
          <div className="space-y-md text-center py-2xl">
            <p className="text-body-sm text-[var(--danger)]">{error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-sm">
            {items.map((item) => (
              <HistoryCard key={item.diagnosisId} item={item} />
            ))}

            {/* Load More */}
            {pagination?.hasMore && (
              <div className="pt-md text-center">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "読み込み中..." : "もっと見る"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

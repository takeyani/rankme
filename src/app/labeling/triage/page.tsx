"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const RANKS = Array.from({ length: 10 }, (_, i) => i + 1);

const RANK_COLORS: Record<number, string> = {
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

interface LabelItem {
  id: string;
  imageUrl: string;
  rank: number;
  labeledBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Summary {
  trainingLabels: { byRank: Record<string, number> };
}

const PAGE_LIMIT = 60;

export default function TriagePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeRank, setActiveRank] = useState<number>(5);
  const [items, setItems] = useState<LabelItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For inline editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load summary (rank counts)
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/learning-summary", { cache: "no-store" });
      if (res.ok) setSummary(await res.json());
    } catch {
      // non-fatal
    }
  }, []);

  // Load items for current rank
  const loadItems = useCallback(
    async (rank: number, after: string | null = null, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ rank: String(rank), limit: String(PAGE_LIMIT) });
        if (after) params.set("cursor", after);
        const res = await fetch(`/api/labels?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setCursor(data.pagination.nextCursor);
        setHasMore(data.pagination.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得失敗");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
    loadItems(activeRank);
  }, [activeRank, loadItems]);

  async function saveCorrection(item: LabelItem, newRank: number) {
    if (newRank === item.rank) {
      setEditingId(null);
      return;
    }
    setSavingId(item.id);
    try {
      const res = await fetch(`/api/labels/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rank: newRank, labeledBy: "triage" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "保存失敗");
      }
      // optimistically remove from current rank list and update summary
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              trainingLabels: {
                ...prev.trainingLabels,
                byRank: {
                  ...prev.trainingLabels.byRank,
                  [item.rank]: (prev.trainingLabels.byRank[item.rank] ?? 0) - 1,
                  [newRank]: (prev.trainingLabels.byRank[newRank] ?? 0) + 1,
                },
              },
            }
          : prev,
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失敗");
    } finally {
      setSavingId(null);
    }
  }

  const byRank = summary?.trainingLabels.byRank ?? {};
  const totalByRank = useMemo(
    () =>
      RANKS.map((r) => ({
        rank: r,
        count: byRank[r] ?? 0,
      })),
    [byRank],
  );

  return (
    <main className="min-h-dvh px-md py-xl">
      <div className="mx-auto w-full max-w-5xl space-y-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/labeling"
            className="flex items-center text-body-sm text-[var(--text-secondary)] transition-colors duration-fast hover:text-[var(--accent)]"
          >
            <ArrowLeft className="mr-xs h-4 w-4" strokeWidth={1.5} />
            ラベリングTOP
          </Link>
          <Link
            href="/learn"
            className="text-body-sm text-[var(--text-secondary)] underline-offset-4 hover:underline"
          >
            学習モード →
          </Link>
        </div>

        <div>
          <h1 className="font-heading text-h2 font-semibold text-[var(--text-primary)]">
            ラベル一括見直し（トリアージ）
          </h1>
          <p className="mt-sm text-body-sm text-[var(--text-secondary)]">
            ランクごとにサムネイル一覧を表示。違和感のあるラベルをクリックして正しいランクに付け直すと、即座に学習データに反映されます。
          </p>
        </div>

        {/* Rank tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="ランク選択">
          {totalByRank.map(({ rank, count }) => (
            <button
              key={rank}
              type="button"
              role="tab"
              aria-selected={activeRank === rank}
              onClick={() => setActiveRank(rank)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-body-sm transition-colors duration-150",
                activeRank === rank
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--muted)]/30 bg-white text-[var(--text-primary)] hover:border-[var(--accent)]",
              )}
            >
              <span className="font-mono font-medium" style={{ color: activeRank === rank ? "white" : RANK_COLORS[rank] }}>
                {rank}
              </span>
              <span className="text-caption">{count}</span>
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-md text-body-sm text-red-700">
            {error}
          </div>
        )}

        {/* Image grid */}
        {loading && items.length === 0 ? (
          <div className="grid grid-cols-3 gap-sm sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-lg text-center text-body-sm text-[var(--text-secondary)]">
              このランクのラベルはありません。
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-sm sm:grid-cols-4 lg:grid-cols-6">
              {items.map((item) => (
                <ThumbnailCell
                  key={item.id}
                  item={item}
                  isEditing={editingId === item.id}
                  isSaving={savingId === item.id}
                  onStartEdit={() => setEditingId(item.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSelectRank={(newRank) => saveCorrection(item, newRank)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="text-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => loadItems(activeRank, cursor, true)}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--muted)]/30 bg-white px-4 py-2 text-body-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  さらに読み込む
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function ThumbnailCell({
  item,
  isEditing,
  isSaving,
  onStartEdit,
  onCancelEdit,
  onSelectRank,
}: {
  item: LabelItem;
  isEditing: boolean;
  isSaving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSelectRank: (rank: number) => void;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--muted)]/20 bg-[var(--muted)]/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={`ラベル ${item.id}`}
        loading="lazy"
        className="h-full w-full object-cover"
      />

      {/* Hover overlay button (when not editing) */}
      {!isEditing && (
        <button
          type="button"
          onClick={onStartEdit}
          aria-label="このラベルを修正"
          className="absolute inset-0 flex items-end justify-end bg-black/0 p-2 transition-colors duration-150 hover:bg-black/30 focus:bg-black/30 focus:outline-none"
        >
          <span className="rounded bg-white/90 px-2 py-1 font-mono text-caption font-medium text-[var(--text-primary)] shadow-sm">
            {item.rank}
          </span>
        </button>
      )}

      {/* Inline rank picker */}
      {isEditing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/70 p-1">
          {isSaving ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <>
              <div className="grid grid-cols-5 gap-0.5">
                {RANKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onSelectRank(n)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded font-mono text-caption font-medium transition-colors duration-100",
                      n === item.rank
                        ? "bg-white/20 text-white ring-1 ring-white/40"
                        : "bg-white text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-white",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={onCancelEdit}
                className="inline-flex items-center gap-1 text-caption text-white/70 hover:text-white"
              >
                <X className="h-3 w-3" />
                キャンセル
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

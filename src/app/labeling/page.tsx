"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

interface LabelItem {
  id: string;
  imageUrl: string;
  rank: number;
  labeledBy: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

interface RankSummary {
  total: number;
  byRank: Record<string, number>;
}

interface LabelsResponse {
  items: LabelItem[];
  pagination: Pagination;
  summary: RankSummary;
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

// --- Rank Selector ---

function RankSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (rank: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[4px]">
      {Array.from({ length: 10 }, (_, i) => {
        const rank = i + 1;
        const isSelected = rank === value;
        return (
          <button
            key={rank}
            type="button"
            className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-caption font-semibold tabular-nums transition-colors duration-fast ${
              isSelected
                ? "text-white"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
            }`}
            style={
              isSelected
                ? { backgroundColor: getScoreColor(rank) }
                : undefined
            }
            onClick={() => onChange(rank)}
            aria-label={`ランク ${rank}`}
            aria-pressed={isSelected}
          >
            {rank}
          </button>
        );
      })}
    </div>
  );
}

// --- Rank Filter ---

function RankFilter({
  selected,
  onChange,
  summary,
}: {
  selected: number | null;
  onChange: (rank: number | null) => void;
  summary: RankSummary | null;
}) {
  return (
    <div className="flex flex-wrap gap-sm">
      <button
        type="button"
        className={`rounded-[var(--radius-button)] px-md py-xs text-caption font-medium transition-colors duration-fast ${
          selected === null
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
        }`}
        onClick={() => onChange(null)}
      >
        全て {summary ? `(${summary.total})` : ""}
      </button>
      {Array.from({ length: 10 }, (_, i) => {
        const rank = i + 1;
        const count = summary?.byRank[String(rank)] ?? 0;
        const isSelected = selected === rank;
        return (
          <button
            key={rank}
            type="button"
            className={`rounded-[var(--radius-button)] px-md py-xs text-caption font-medium tabular-nums transition-colors duration-fast ${
              isSelected
                ? "text-white"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
            }`}
            style={
              isSelected
                ? { backgroundColor: getScoreColor(rank) }
                : undefined
            }
            onClick={() => onChange(rank)}
          >
            {rank} ({count})
          </button>
        );
      })}
    </div>
  );
}

// --- Delete Confirmation Dialog ---

function DeleteConfirmDialog({
  count,
  onConfirm,
  onCancel,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-md w-full max-w-sm">
        <CardContent className="space-y-lg p-lg">
          <h3 className="font-heading text-h4 font-semibold text-[var(--text-primary)]">
            ラベルの削除
          </h3>
          <p className="text-body-sm text-[var(--text-secondary)]">
            {count === 1
              ? "このラベルを削除しますか？"
              : `選択した ${count} 件のラベルを削除しますか？`}
          </p>
          <p className="text-caption text-[var(--danger)]">
            この操作は取り消せません。
          </p>
          <div className="flex gap-sm">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              キャンセル
            </Button>
            <Button variant="destructive" onClick={onConfirm} className="flex-1">
              <Trash2 className="mr-xs h-4 w-4" strokeWidth={1.5} />
              削除
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- New Label Modal ---

function NewLabelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rank, setRank] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;

      const allowedTypes = ["image/jpeg", "image/png"];
      if (!allowedTypes.includes(selected.type)) {
        setError("JPEG または PNG 形式の画像を選択してください");
        return;
      }
      if (selected.size > 5 * 1024 * 1024) {
        setError("ファイルサイズは 5MB 以下にしてください");
        return;
      }

      setError(null);
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
    },
    []
  );

  // Clean up preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = useCallback(async () => {
    if (!file) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("rank", String(rank));

      const response = await fetch("/api/labels", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message ?? "登録に失敗しました");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }, [file, rank, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-md w-full max-w-md">
        <CardContent className="space-y-lg p-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-h4 font-semibold text-[var(--text-primary)]">
              新規登録
            </h3>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors duration-fast hover:bg-[var(--secondary)]"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Image Upload */}
          {previewUrl ? (
            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--radius-image)]">
              <img
                src={previewUrl}
                alt="アップロード画像のプレビュー"
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="absolute right-sm top-sm flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70"
                aria-label="画像を削除"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-video w-full cursor-pointer flex-col items-center justify-center rounded-[var(--radius-image)] border-2 border-dashed border-[var(--subtle)] bg-[var(--surface)] transition-colors duration-normal hover:border-[var(--accent)]"
            >
              <Upload
                className="mb-sm h-8 w-8 text-[var(--muted)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="text-body-sm text-[var(--text-secondary)]">
                画像を選択
              </p>
              <p className="text-caption text-[var(--muted)]">
                JPEG / PNG, 最大 5MB
              </p>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleFileChange}
            aria-hidden="true"
          />

          {/* Rank Selection */}
          <div className="space-y-sm">
            <label className="text-body-sm font-medium text-[var(--text-primary)]">
              ランク
            </label>
            <RankSelector value={rank} onChange={setRank} />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-sm text-body-sm text-[var(--danger)]">
              <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-sm">
            <Button variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!file || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "登録中..." : "登録"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Label Card ---

function LabelCard({
  item,
  isSelected,
  onSelect,
  onRankChange,
  onDelete,
  onError,
}: {
  item: LabelItem;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onRankChange: (id: string, rank: number) => void;
  onDelete: (id: string) => void;
  onError?: (message: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRankChange = useCallback(
    async (newRank: number) => {
      if (newRank === item.rank) return;

      setIsUpdating(true);
      try {
        const response = await fetch(`/api/labels/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rank: newRank }),
        });

        if (!response.ok) {
          throw new Error("ランクの更新に失敗しました");
        }

        onRankChange(item.id, newRank);
      } catch {
        onError?.("ランクの更新に失敗しました");
      } finally {
        setIsUpdating(false);
      }
    },
    [item.id, item.rank, onRankChange, onError]
  );

  return (
    <Card
      className={`overflow-hidden transition-colors duration-normal ${
        isSelected ? "border-[var(--accent)] ring-1 ring-[var(--accent)]" : ""
      }`}
    >
      {/* Checkbox + Image */}
      <div className="relative aspect-square">
        <img
          src={item.imageUrl}
          alt={`ランク ${item.rank} のラベリング画像`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {/* Checkbox */}
        <label className="absolute left-sm top-sm">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item.id, e.target.checked)}
            className="h-5 w-5 cursor-pointer rounded-[var(--radius-sm)] border-[var(--border)] accent-[var(--accent)]"
            aria-label={`ラベル ${item.id} を選択`}
          />
        </label>
        {/* Delete button */}
        <button
          onClick={() => onDelete(item.id)}
          className="absolute right-sm top-sm flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-[var(--danger)]"
          aria-label="削除"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        {/* Updating indicator */}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="animate-pulse text-white">
              <CheckCircle className="h-6 w-6" strokeWidth={1.5} />
            </div>
          </div>
        )}
      </div>

      {/* Rank Selector */}
      <CardContent className="p-sm">
        <RankSelector value={item.rank} onChange={handleRankChange} />
      </CardContent>
    </Card>
  );
}

// --- Loading Skeletons ---

function LabelGridSkeletons() {
  return (
    <div
      className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4"
      aria-busy="true"
      aria-label="読み込み中"
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="space-y-sm">
          <Skeleton className="aspect-square w-full rounded-[var(--radius-card)]" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

// --- Empty State ---

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-lg py-3xl text-center">
      <div className="space-y-sm">
        <p className="text-body-lg font-medium text-[var(--text-primary)]">
          ラベリングデータがありません
        </p>
        <p className="text-body-sm text-[var(--text-secondary)]">
          新規登録してください。
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="mr-xs h-4 w-4" strokeWidth={1.5} />
        新規登録
      </Button>
    </div>
  );
}

// --- Main Page ---

export default function LabelingPage() {
  const [items, setItems] = useState<LabelItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [summary, setSummary] = useState<RankSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankFilter, setRankFilter] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [refetchKey, setRefetchKey] = useState(0);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchLabels = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (rankFilter !== null) params.set("rank", String(rankFilter));
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "50");

      const response = await fetch(`/api/labels?${params.toString()}`);
      if (!response.ok) {
        throw new Error("ラベルの取得に失敗しました");
      }

      return (await response.json()) as LabelsResponse;
    },
    [rankFilter]
  );

  // Initial load + filter changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setSelectedIds(new Set());

      try {
        const data = await fetchLabels();
        if (!cancelled) {
          setItems(data.items);
          setPagination(data.pagination);
          setSummary(data.summary);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchLabels, refetchKey]);

  // Load more
  const handleLoadMore = useCallback(async () => {
    if (!pagination?.nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchLabels(pagination.nextCursor);
      setItems((prev) => [...prev, ...data.items]);
      setPagination(data.pagination);
    } catch {
      setError("追加読み込みに失敗しました");
    } finally {
      setIsLoadingMore(false);
    }
  }, [pagination, isLoadingMore, fetchLabels]);

  // Selection handlers
  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Rank change handler
  const handleRankChange = useCallback((id: string, newRank: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, rank: newRank } : item))
    );
  }, []);

  // Delete handler
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await Promise.all(
        deleteTarget.map((id) =>
          fetch(`/api/labels/${id}`, { method: "DELETE" })
        )
      );

      setItems((prev) => prev.filter((item) => !deleteTarget.includes(item.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleteTarget.forEach((id) => next.delete(id));
        return next;
      });
      setNotification(`${deleteTarget.length} 件のラベルを削除しました`);
      setTimeout(() => setNotification(null), 3000);
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  // Bulk delete
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteTarget(Array.from(selectedIds));
  }, [selectedIds]);

  // Single delete
  const handleSingleDelete = useCallback((id: string) => {
    setDeleteTarget([id]);
  }, []);

  // On label created
  const handleLabelCreated = useCallback(() => {
    setShowNewModal(false);
    setNotification("ラベルを登録しました");
    setTimeout(() => setNotification(null), 3000);
    setRefetchKey((k) => k + 1);
  }, []);

  return (
    <main className="min-h-dvh px-md py-2xl">
      <div className="mx-auto w-full max-w-6xl space-y-xl">
        {/* Header */}
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

        <div className="flex flex-wrap items-center justify-between gap-md">
          <h1 className="font-heading text-h2 font-semibold text-[var(--text-primary)]">
            ラベリング管理
          </h1>
          <Button onClick={() => setShowNewModal(true)}>
            <Plus className="mr-xs h-4 w-4" strokeWidth={1.5} />
            新規登録
          </Button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4 lg:grid-cols-6">
            <Card>
              <CardContent className="p-md text-center">
                <p className="text-caption text-[var(--text-secondary)]">総登録数</p>
                <p className="font-score text-h3 font-bold tabular-nums text-[var(--text-primary)]">
                  {summary.total}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Rank Filter */}
        <RankFilter
          selected={rankFilter}
          onChange={setRankFilter}
          summary={summary}
        />

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-md">
            <span className="text-body-sm text-[var(--text-secondary)]">
              {selectedIds.size} 件選択中
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="mr-xs h-3.5 w-3.5" strokeWidth={1.5} />
              一括削除
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              選択解除
            </Button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <LabelGridSkeletons />
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
          <EmptyState onAdd={() => setShowNewModal(true)} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <LabelCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  onRankChange={handleRankChange}
                  onDelete={handleSingleDelete}
                  onError={(msg) => {
                    setNotification(msg);
                    setTimeout(() => setNotification(null), 3000);
                  }}
                />
              ))}
            </div>

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
          </>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-xl right-xl z-50 flex items-center gap-sm rounded-[var(--radius-card)] bg-[var(--primary)] px-lg py-md text-body-sm text-white shadow-lg">
          <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
          {notification}
        </div>
      )}

      {/* Modals */}
      {showNewModal && (
        <NewLabelModal
          onClose={() => setShowNewModal(false)}
          onCreated={handleLabelCreated}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          count={deleteTarget.length}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}

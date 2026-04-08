"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImageOff, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

interface Advice {
  id: number;
  title?: string;
  text: string;
}

interface DiagnosisDetail {
  diagnosisId: string;
  rank: number;
  advice: Advice[];
  engineType: string;
  createdAt: string;
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

// --- Rank Scale Bar ---

function RankScaleBar({ rank }: { rank: number }) {
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`ランクスケール: ${rank} / 10`}>
      {Array.from({ length: 10 }, (_, i) => {
        const r = i + 1;
        const isActive = r <= rank;
        return (
          <div
            key={r}
            className="h-2 flex-1 rounded-full transition-colors duration-slow"
            style={{
              backgroundColor: isActive ? getScoreColor(rank) : "var(--subtle)",
            }}
          />
        );
      })}
    </div>
  );
}

// --- Loading Skeleton ---

function DetailSkeleton() {
  return (
    <div className="space-y-xl" aria-busy="true" aria-label="読み込み中">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mx-auto h-48 w-48 rounded-[var(--radius-image)]" />
      <Skeleton className="mx-auto h-20 w-20 rounded-[var(--radius-score-display)]" />
      <Skeleton className="h-3 w-full" />
      <div className="space-y-sm">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

// --- Not Found State ---

function NotFoundState() {
  return (
    <div className="flex flex-col items-center gap-lg py-3xl text-center">
      <div className="space-y-sm">
        <p className="text-body-lg font-medium text-[var(--text-primary)]">
          診断結果が見つかりません
        </p>
        <p className="text-body-sm text-[var(--text-secondary)]">
          指定されたIDの診断結果は存在しないか、削除されています。
        </p>
      </div>
      <Link href="/history">
        <Button variant="outline">
          <ArrowLeft className="mr-xs h-4 w-4" strokeWidth={1.5} />
          一覧に戻る
        </Button>
      </Link>
    </div>
  );
}

// --- Main Page ---

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [diagnosis, setDiagnosis] = useState<DiagnosisDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      setIsNotFound(false);

      try {
        const response = await fetch(`/api/history/${id}`);

        if (response.status === 404) {
          if (!cancelled) setIsNotFound(true);
          return;
        }

        if (!response.ok) {
          throw new Error("診断結果の取得に失敗しました");
        }

        const data: DiagnosisDetail = await response.json();
        if (!cancelled) setDiagnosis(data);
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
  }, [id]);

  return (
    <main className="min-h-dvh px-md py-2xl">
      <div className="mx-auto w-full max-w-md space-y-xl">
        {/* Back link */}
        <Link
          href="/history"
          className="inline-flex items-center text-body-sm text-[var(--text-secondary)] transition-colors duration-fast hover:text-[var(--accent)]"
          aria-label="一覧に戻る"
        >
          <ArrowLeft className="mr-xs h-4 w-4" strokeWidth={1.5} />
          一覧に戻る
        </Link>

        {/* Content */}
        {isLoading ? (
          <DetailSkeleton />
        ) : isNotFound ? (
          <NotFoundState />
        ) : error ? (
          <div className="space-y-md text-center py-2xl">
            <p className="text-body-sm text-[var(--danger)]">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
          </div>
        ) : diagnosis ? (
          <div className="space-y-xl">
            {/* Diagnosis Date */}
            <p className="text-caption text-[var(--text-secondary)]">
              診断日時: {formatDate(diagnosis.createdAt)}
            </p>

            {/* Image Placeholder */}
            <div className="flex aspect-square w-full items-center justify-center rounded-[var(--radius-image)] border border-dashed border-[var(--border)] bg-[var(--surface)]">
              <div className="flex flex-col items-center gap-sm text-[var(--muted)]">
                <ImageOff className="h-12 w-12" strokeWidth={1} aria-hidden="true" />
                <p className="text-caption">画像は保存されていません</p>
              </div>
            </div>

            {/* Score Display */}
            <div className="text-center">
              <h2 className="mb-md font-heading text-h3 font-semibold text-[var(--text-primary)]">
                診断結果
              </h2>
              <div
                className="font-score tabular-nums text-score-display font-bold leading-none"
                style={{ color: getScoreColor(diagnosis.rank) }}
                aria-label={`ランク: ${diagnosis.rank} / 10`}
              >
                {diagnosis.rank}
                <span className="ml-xs text-h3 font-medium text-[var(--text-secondary)]">
                  / 10
                </span>
              </div>
            </div>

            {/* Scale Bar */}
            <RankScaleBar rank={diagnosis.rank} />

            {/* Advice Section */}
            <div className="space-y-md">
              <h3 className="font-heading text-h4 font-semibold text-[var(--text-primary)]">
                改善アドバイス
              </h3>
              <div className="space-y-sm">
                {diagnosis.advice?.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="flex items-start gap-md p-md">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-caption font-semibold text-[var(--accent)]">
                        {item.id}
                      </span>
                      <div className="flex-1">
                        {item.title && (
                          <p className="text-body-sm font-semibold text-[var(--text-primary)] mb-xs">
                            {item.title}
                          </p>
                        )}
                        <p className="text-advice leading-relaxed text-[var(--text-secondary)]">
                          {item.text}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="space-y-xs text-center text-caption text-[var(--text-secondary)]">
              <p>
                本判定は、選別済み画像データとの類似度および傾向分析に基づく客観的結果です。
              </p>
              <p>個人の価値や魅力を断定するものではありません。</p>
            </div>

            {/* Actions */}
            <Button
              size="lg"
              className="w-full"
              onClick={() => router.push("/")}
            >
              <RefreshCw className="mr-sm h-4 w-4" strokeWidth={1.5} />
              もう一度診断
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

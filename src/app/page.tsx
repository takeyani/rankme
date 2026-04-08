"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, AlertCircle, RefreshCw, History, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// --- Types ---

interface Advice {
  id: number;
  title?: string;
  text: string;
}

interface DiagnosisResult {
  diagnosisId: string;
  rank: number;
  advice: Advice[];
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

// --- Consent Dialog ---

function ConsentDialog({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-md w-full max-w-lg">
        <CardContent className="space-y-lg p-lg">
          <h2 className="font-heading text-h3 font-semibold text-[var(--text-primary)]">
            ご利用にあたって
          </h2>
          <div className="space-y-md text-[0.9375rem] leading-relaxed text-[var(--text-secondary)]">
            <p>
              RankMe は、選別済み画像データとの類似度および傾向分析に基づき、客観的なランク評価を行うAI診断ツールです。
            </p>
            <p>
              本サービスの判定結果は、個人の価値や魅力を断定するものではありません。あくまで参考情報としてご利用ください。
            </p>
            <p>
              アップロードされた画像はサーバーに永続保存されません。診断結果（ランクとアドバイス）のみが記録されます。
            </p>
          </div>
          <Button onClick={onAccept} className="w-full" size="lg">
            同意して始める
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Upload Dropzone ---

function UploadDropzone({
  selectedFile,
  previewUrl,
  onFileSelect,
  error,
}: {
  selectedFile: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndSelect = useCallback(
    (file: File) => {
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div className="space-y-sm">
      <div
        role="button"
        tabIndex={0}
        aria-label="画像をドラッグ＆ドロップ、またはクリックして選択"
        className={`group relative flex aspect-[4/3] sm:aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius-image)] border-2 border-dashed transition-colors duration-normal ${
          isDragOver
            ? "border-[var(--accent)] bg-[var(--accent)]/5"
            : selectedFile
              ? "border-[var(--border)] bg-[var(--surface)]"
              : "border-[var(--subtle)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--secondary)]"
        }`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="選択された画像のプレビュー"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <Upload
              className="mb-md h-12 w-12 text-[var(--muted)] transition-colors duration-normal group-hover:text-[var(--accent)]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <p className="text-body-sm text-[var(--text-secondary)]">
              画像をドラッグ＆ドロップ、またはクリックして選択
            </p>
            <p className="mt-xs text-caption text-[var(--muted)]">
              JPEG / PNG, 最大 5MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleChange}
          aria-hidden="true"
        />
      </div>
      {selectedFile && (
        <p className="text-center text-caption text-[var(--text-secondary)]">
          {selectedFile.name}
        </p>
      )}
      {error && (
        <div className="flex items-center gap-sm text-body-sm text-[var(--danger)]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={1.5} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// --- Loading Skeleton ---

function DiagnosisLoadingSkeleton() {
  return (
    <div className="w-full max-w-md space-y-xl" aria-busy="true" aria-label="AI分析中">
      <div className="text-center">
        <p className="text-body-lg font-medium text-[var(--text-primary)]">AI分析中...</p>
        <p className="mt-sm text-body-sm text-[var(--text-secondary)]">
          画像を解析しています
        </p>
      </div>
      <Skeleton className="mx-auto h-24 w-24 rounded-[var(--radius-score-display)]" />
      <div className="space-y-md">
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
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

// --- Diagnosis Report ---

function DiagnosisReport({ result, imageUrl }: { result: DiagnosisResult; imageUrl?: string | null }) {
  const rankLabel = result.rank <= 3 ? "もう少し頑張ろう" : result.rank <= 5 ? "なかなか良い感じ" : result.rank <= 7 ? "かなりの高評価" : result.rank <= 9 ? "トップクラス" : "最高ランク";

  return (
    <div className="w-full max-w-md space-y-lg">
      {/* Result image - circular */}
      {imageUrl && (
        <div className="flex justify-center">
          <div className="relative h-[216px] w-[216px] overflow-hidden rounded-full border-4 border-[var(--accent)]/30 shadow-lg">
            <img
              src={imageUrl}
              alt="診断に使用した画像"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Score card with gradient */}
      <div
        className="relative w-full rounded-xl px-7 py-6 text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #c471a5, #8b5cf6)" }}
      >
        <div className="text-center text-sm font-medium opacity-90">
          {new Date(result.createdAt).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold opacity-90">ビューティーランク</p>
            <div className="mt-1 flex items-baseline justify-center gap-1">
              <span className="font-score tabular-nums text-[54px] font-light leading-none tracking-tight">
                {result.rank}
              </span>
              <span className="text-lg font-medium opacity-70">/ 10</span>
            </div>
          </div>
          {imageUrl && (
            <div className="flex-shrink-0">
              <img
                src={imageUrl}
                alt=""
                className="h-[80px] w-[80px] rounded-full object-cover border-2 border-white/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Scale Bar */}
      <RankScaleBar rank={result.rank} />

      {/* Result description */}
      <div className="rounded-lg bg-[#F6F1FA] p-4 px-6">
        <h3 className="text-center text-[15px] font-semibold tracking-wide text-[#9935C7]">
          {rankLabel}
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6b5b7b]">
          {result.rank <= 3
            ? "基礎的なケアを見直すことで、大きくスコアアップが見込めます。以下のアドバイスを参考にしてみてください。"
            : result.rank <= 5
              ? "平均以上の評価です。いくつかのポイントを改善することで、さらに上のランクを目指せます。"
              : result.rank <= 7
                ? "高い評価を獲得しています。細かなポイントを磨くことで、トップランクに近づけます。"
                : result.rank <= 9
                  ? "非常に高い評価です。現在のケアを維持しつつ、微調整で完璧に近づけましょう。"
                  : "最高評価です。現在の状態をキープすることが最優先です。"}
        </p>
      </div>

      {/* Advice Section */}
      <div className="rounded-lg bg-[#F1FAF6] p-4 px-6">
        <h3 className="text-center text-[15px] font-semibold tracking-wide text-[#2D8A5E]">
          スコアアップのアドバイス
        </h3>
        <ul className="mt-3 space-y-3">
          {result.advice.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#2D8A5E]/10 text-[11px] font-bold text-[#2D8A5E]">
                {item.id}
              </span>
              <div className="flex-1">
                {item.title && (
                  <p className="text-[13px] font-semibold text-[#2D8A5E]">
                    {item.title}
                  </p>
                )}
                <p className="text-[13px] leading-relaxed text-[#4a7a63]">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Disclaimer */}
      <div className="space-y-xs text-center text-caption text-[var(--text-secondary)]">
        <p>
          本判定は、選別済み画像データとの類似度および傾向分析に基づく客観的結果です。
        </p>
        <p>個人の価値や魅力を断定するものではありません。</p>
      </div>
    </div>
  );
}

// --- Main Page ---

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const CONSENT_KEY = "rankme_consent_accepted";

export default function HomePage() {
  const router = useRouter();
  const [hasConsented, setHasConsented] = useState(true); // default true to avoid flash
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check consent on mount
  useEffect(() => {
    const accepted = localStorage.getItem(CONSENT_KEY);
    if (!accepted) {
      setHasConsented(false);
    }
  }, []);

  const handleConsent = useCallback(() => {
    localStorage.setItem(CONSENT_KEY, "true");
    setHasConsented(true);
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("JPEG または PNG 形式の画像を選択してください");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("ファイルサイズは 5MB 以下にしてください");
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleDiagnose = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch("/api/diagnose", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error?.message ?? "診断中にエラーが発生しました。もう一度お試しください。"
        );
      }

      const data: DiagnosisResult = await response.json();
      setResult(data);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === "AbortError") {
          setError("AI推論がタイムアウトしました。もう一度お試しください。");
        } else {
          setError(err.message);
        }
      } else {
        setError("予期しないエラーが発生しました。");
      }
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
  }, []);

  // Consent Dialog
  if (!hasConsented) {
    return <ConsentDialog onAccept={handleConsent} />;
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-md py-3xl">
      {isUploading ? (
        <DiagnosisLoadingSkeleton />
      ) : result ? (
        <div className="w-full max-w-md space-y-xl">
          <DiagnosisReport result={result} imageUrl={previewUrl} />
          <div className="flex flex-col gap-sm">
            <Button onClick={handleReset} size="lg" className="w-full">
              <RefreshCw className="mr-sm h-4 w-4" strokeWidth={1.5} />
              もう一度診断
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() => router.push("/history")}
            >
              <History className="mr-sm h-4 w-4" strokeWidth={1.5} />
              履歴を見る
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-xl text-center">
          {/* Title */}
          <div className="space-y-sm">
            <h1 className="font-heading text-h1 font-bold tracking-tight text-[var(--text-primary)]">
              RankMe
            </h1>
            <p className="text-body-sm text-[var(--text-secondary)]">
              AI顔診断プラットフォーム
            </p>
          </div>

          {/* Upload Area */}
          <UploadDropzone
            selectedFile={selectedFile}
            previewUrl={previewUrl}
            onFileSelect={handleFileSelect}
            error={error}
          />

          {/* Diagnose Button */}
          <Button
            onClick={handleDiagnose}
            disabled={!selectedFile || isUploading}
            size="lg"
            className="w-full"
            aria-label="診断する"
          >
            {isUploading ? (
              <>
                <RefreshCw className="mr-sm h-4 w-4 animate-spin" strokeWidth={1.5} />
                AI分析中...
              </>
            ) : (
              <>
                <ImageIcon className="mr-sm h-4 w-4" strokeWidth={1.5} />
                診断する
              </>
            )}
          </Button>

          {/* History Link */}
          <button
            onClick={() => router.push("/history")}
            className="inline-block text-body-sm text-[var(--text-secondary)] underline-offset-4 transition-colors duration-fast hover:text-[var(--accent)] hover:underline"
          >
            履歴を見る
          </button>
        </div>
      )}
    </main>
  );
}

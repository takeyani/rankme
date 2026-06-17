"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "ask" | "select" | "submitting" | "thanks_confirmed" | "thanks_corrected";

function confidenceLabel(v: number): string {
  return ["うろ覚え", "やや弱い", "中くらい", "わりと自信", "確信"][v - 1] ?? "中くらい";
}

interface CorrectionFeedbackProps {
  diagnosisId: string;
  originalRank: number;
  className?: string;
}

export function CorrectionFeedback({
  diagnosisId,
  originalRank,
  className,
}: CorrectionFeedbackProps) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  // 1 = うろ覚え / 5 = 確信。デフォルトは中間 (3)。
  // ラベルノイズ低減のため、サーバ側で confidence で重み付けして集約する。
  const [confidence, setConfidence] = useState<number>(3);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 元のランクと同じ値を選んだら送信は無意味 (中央値集約のノイズになる)。
  // 「これは元の判定です」と明示し、submitボタンも抑止する。
  const isSameAsOriginal = selectedRank === originalRank;

  function resetToAsk() {
    setSelectedRank(null);
    setNote("");
    setConfidence(3);
    setError(null);
    setPhase("ask");
  }

  // 1〜9 → ranks 1〜9 / 0 → rank 10 / Esc → cancel / Enter → submit
  // select phase 中だけ作動。テキスト入力欄にフォーカスがあるときはスキップ。
  useEffect(() => {
    if (phase !== "select") return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        setSelectedRank(Number(e.key));
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setSelectedRank(10);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        resetToAsk();
        return;
      }
      if (e.key === "Enter" && selectedRank !== null && selectedRank !== originalRank) {
        e.preventDefault();
        submit(selectedRank, note, confidence);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // 依存に submit を入れると関数が毎回再生成されて effect が再bind するため、
    // 直近の state スナップショットを使う closure に絞る。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedRank, originalRank, note, confidence]);

  async function submit(corrected: number, comment: string, conf: number) {
    setPhase("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/diagnose/${diagnosisId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correctedRank: corrected,
          confidenceScore: conf,
          note: comment || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? "送信に失敗しました");
      }
      setPhase("thanks_corrected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "送信に失敗しました");
      setPhase("select");
    }
  }

  if (phase === "thanks_confirmed") {
    return (
      <div
        role="status"
        className={cn(
          "w-full rounded-[var(--radius-md)] border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3 text-center",
          className,
        )}
      >
        <p className="text-sm text-[var(--text-primary)]">
          フィードバックありがとうございます。
        </p>
      </div>
    );
  }

  if (phase === "thanks_corrected") {
    return (
      <div
        role="status"
        className={cn(
          "w-full rounded-[var(--radius-md)] border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-4 py-3",
          className,
        )}
      >
        <p className="text-sm font-medium text-[var(--text-primary)]">
          ご協力ありがとうございました。
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          <span className="font-mono">{originalRank}</span> 位 →{" "}
          <span className="font-mono">{selectedRank}</span> 位として記録しました。次回以降の判定精度向上に使われます。
        </p>
        {/*
          一度送って終わりにせず、後から「やっぱり違う値だった」と気付いた時の
          再修正導線を残しておく。サーバ側は中央値で集約するので、繰り返し送っても
          1件のノイズで結論は揺れない設計。
        */}
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhase("select");
              setError(null);
            }}
            aria-label="もう一度修正する"
          >
            もう一度直す
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="判定結果のフィードバック"
      className={cn(
        "w-full rounded-[var(--radius-md)] border border-[var(--muted)]/20 bg-[var(--muted)]/5 p-4",
        className,
      )}
    >
      {phase === "ask" && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--text-primary)] text-center">
            この判定結果は適切でしたか？
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5"
              onClick={() => setPhase("thanks_confirmed")}
              aria-label="判定結果は適切でした"
            >
              <Check className="w-4 h-4" />
              適切でした
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial gap-1.5"
              onClick={() => setPhase("select")}
              aria-label="判定結果を修正したい"
            >
              <X className="w-4 h-4" />
              修正したい
            </Button>
          </div>
        </div>
      )}

      {(phase === "select" || phase === "submitting") && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            本来は何位が適切でしたか？
            <span className="ml-2 text-[10px] font-normal text-[var(--text-secondary)]">
              （キーボード 1–9 / 0=10 で選択、Enter で送信）
            </span>
          </p>
          {/*
            "元のランク → 選択中のランク" を矢印で明示。
            「何を何に変えるのか」を見せた方が誤操作が減る。
          */}
          <div
            className="flex items-center justify-center gap-2 text-sm text-[var(--text-secondary)]"
            aria-live="polite"
          >
            <span className="font-mono">{originalRank}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            <span
              className={cn(
                "font-mono",
                selectedRank !== null
                  ? isSameAsOriginal
                    ? "text-[var(--text-secondary)]"
                    : "text-[var(--accent)] font-semibold"
                  : "text-[var(--text-secondary)]/50",
              )}
            >
              {selectedRank ?? "?"}
            </span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={phase === "submitting"}
                onClick={() => setSelectedRank(n)}
                aria-pressed={selectedRank === n}
                className={cn(
                  "h-10 rounded-md font-mono text-sm transition-all duration-150",
                  selectedRank === n
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-white border border-[var(--muted)]/30 text-[var(--text-primary)] hover:border-[var(--accent)]",
                  n === originalRank && "ring-2 ring-[var(--muted)]/30",
                  phase === "submitting" && "opacity-50 cursor-not-allowed",
                )}
                aria-label={`ランク${n}を選択${n === originalRank ? "（元の判定）" : ""}`}
              >
                {n}
              </button>
            ))}
          </div>
          {selectedRank !== null && (
            <>
              {isSameAsOriginal && (
                <p className="text-xs text-[var(--text-secondary)] text-center" role="note">
                  これは元の判定と同じです。確認だけで OK なら「適切でした」を使ってください。
                </p>
              )}
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>どのくらい確信がありますか？</span>
                  <span className="font-mono">{confidenceLabel(confidence)}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  disabled={phase === "submitting"}
                  className="mt-1 w-full accent-[var(--accent)]"
                  aria-label="確信度（1：うろ覚え 〜 5：確信）"
                />
                <div className="mt-0.5 flex justify-between text-[10px] text-[var(--text-secondary)]/70">
                  <span>うろ覚え</span>
                  <span>確信</span>
                </div>
              </div>
              <label className="block text-xs text-[var(--text-secondary)]">
                コメント（任意）
                <textarea
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={phase === "submitting"}
                  placeholder="例：照明の影響で実際より暗く写った"
                  className="mt-1 w-full rounded-md border border-[var(--muted)]/30 bg-white p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:border-[var(--accent)]"
                />
              </label>
              {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetToAsk}
                  disabled={phase === "submitting"}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => submit(selectedRank, note, confidence)}
                  disabled={phase === "submitting" || isSameAsOriginal}
                  title={isSameAsOriginal ? "元の判定と同じ値は送れません" : undefined}
                >
                  {phase === "submitting" ? "送信中…" : "フィードバックを送る"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Phase = "ask" | "select" | "submitting" | "thanks_confirmed" | "thanks_corrected";

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
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(corrected: number, comment: string) {
    setPhase("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/diagnose/${diagnosisId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctedRank: corrected, note: comment || undefined }),
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
          このフィードバック（本来は <span className="font-mono">{selectedRank}</span> 位）は、次回以降の判定精度向上に使われます。
        </p>
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
          </p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                disabled={phase === "submitting"}
                onClick={() => setSelectedRank(n)}
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
                  onClick={() => {
                    setSelectedRank(null);
                    setNote("");
                    setPhase("ask");
                    setError(null);
                  }}
                  disabled={phase === "submitting"}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => submit(selectedRank, note)}
                  disabled={phase === "submitting"}
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

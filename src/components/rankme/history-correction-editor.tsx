"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Pencil, Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface HistoryCorrectionEditorProps {
  diagnosisId: string
  originalRank: number
  currentCorrectedRank: number | null
  onSaved: (correctedRank: number) => void
  className?: string
}

/**
 * Inline editor for the history list. Opens a 1〜10 picker on click,
 * submits to /api/diagnose/{id}/correction, and notifies parent on save.
 *
 * Tap targets are large enough for mobile use.
 */
export function HistoryCorrectionEditor({
  diagnosisId,
  originalRank,
  currentCorrectedRank,
  onSaved,
  className,
}: HistoryCorrectionEditorProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(currentCorrectedRank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 同値送信は中央値集約の純粋なノイズになるので submit を抑止する。
  // 「元の判定 = AIランク」を基準にする。currentCorrectedRank と比較しないのは
  // 履歴上で表示されている "元のランク" がAI判定だから。
  const isSameAsOriginal = selected === originalRank

  // キーボードショートカット: 1-9 / 0=10 / Esc / Enter
  // open状態のときだけ作動。テキスト入力欄にフォーカスがある時はスキップ
  // (現状このエディタには text input は無いが、将来の追加に備える)。
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault()
        setSelected(Number(e.key))
        return
      }
      if (e.key === "0") {
        e.preventDefault()
        setSelected(10)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        setError(null)
        return
      }
      if (e.key === "Enter" && selected !== null && selected !== originalRank) {
        e.preventDefault()
        // 関数参照は state ベースで毎レンダ生成なので、直接呼ぶ
        void saveByValue(selected)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // saveByValue/selected は最新を見たいので依存に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, originalRank])

  async function saveByValue(value: number) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagnose/${diagnosisId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 履歴から落ち着いて見直す = 高確信前提なので 5 で記録する。
        // ノイズ抑止 (CorrectionSample.confidenceScore による重み付け集約) と
        // 整合させるため明示的に指定。
        body: JSON.stringify({ correctedRank: value, confidenceScore: 5 }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message ?? "保存に失敗しました")
      }
      onSaved(value)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(true)
    setSelected(currentCorrectedRank)
    setError(null)
  }

  function cancel(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setOpen(false)
    setError(null)
  }

  async function save(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (selected === null) return
    await saveByValue(selected)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={startEdit}
        aria-label={
          currentCorrectedRank !== null
            ? `修正済みランク ${currentCorrectedRank} を再修正`
            : "正解ランクを修正"
        }
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-[var(--muted)]/30 bg-white px-2.5 py-1.5 text-caption font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--accent)] hover:bg-[var(--accent)]/5",
          className,
        )}
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        {currentCorrectedRank !== null ? "再修正" : "修正"}
      </button>
    )
  }

  return (
    <div
      className={cn("flex flex-col gap-2 w-full", className)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-[var(--text-secondary)]">本来のランク：</p>
        {/* 元判定 → 選択値 を矢印で可視化 (キーボード 1-9 / 0 で選択可) */}
        <div
          className="flex items-center gap-1.5 text-caption text-[var(--text-secondary)]"
          aria-live="polite"
        >
          <span className="font-mono">{originalRank}</span>
          <ArrowRight className="h-3 w-3" aria-hidden />
          <span
            className={cn(
              "font-mono",
              selected !== null
                ? isSameAsOriginal
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--accent)] font-semibold"
                : "text-[var(--text-secondary)]/50",
            )}
          >
            {selected ?? "?"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            disabled={saving}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setSelected(n)
            }}
            aria-pressed={selected === n}
            className={cn(
              "h-9 rounded-md font-mono text-sm transition-all duration-150",
              selected === n
                ? "bg-[var(--accent)] text-white shadow-sm"
                : "border border-[var(--muted)]/30 bg-white text-[var(--text-primary)] hover:border-[var(--accent)]",
              n === originalRank && "ring-2 ring-[var(--muted)]/40",
              saving && "cursor-not-allowed opacity-50",
            )}
            aria-label={`ランク${n}を選択${n === originalRank ? "（元の判定）" : ""}`}
          >
            {n}
          </button>
        ))}
      </div>
      {isSameAsOriginal && (
        <p role="note" className="text-caption text-[var(--text-secondary)]">
          元の判定と同じです。変更したい場合は他のランクを選んでください。
        </p>
      )}
      {error && (
        <p role="alert" className="text-caption text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-caption text-[var(--text-secondary)] hover:bg-[var(--muted)]/10"
        >
          <X className="h-3.5 w-3.5" />
          キャンセル
        </button>
        <button
          type="button"
          onClick={save}
          disabled={selected === null || saving || isSameAsOriginal}
          title={isSameAsOriginal ? "元の判定と同じ値は送れません" : undefined}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] px-3 py-1.5 text-caption font-medium text-white transition-colors duration-150 hover:bg-[var(--accent)]/90 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5" aria-hidden />
          )}
          保存
        </button>
      </div>
    </div>
  )
}

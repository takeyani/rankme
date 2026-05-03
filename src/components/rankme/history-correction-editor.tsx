"use client"

import { useState } from "react"
import { Pencil, Check, X, Loader2 } from "lucide-react"
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
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/diagnose/${diagnosisId}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correctedRank: selected }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error?.message ?? "保存に失敗しました")
      }
      onSaved(selected)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
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
      <p className="text-caption text-[var(--text-secondary)]">本来のランク：</p>
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
          disabled={selected === null || saving}
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

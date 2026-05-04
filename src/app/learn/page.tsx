"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, BookOpen, Brain, Download, FileText, Tags, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Summary {
  generatedAt: string
  trainingLabels: {
    total: number
    byRank: Record<string, number>
  }
  diagnoses: {
    total: number
  }
  corrections: {
    total: number
    meanAbsoluteDelta: number
    deltaDistribution: Record<string, number>
    lastWeek: number
    lastMonth: number
  }
  biasMap: Record<string, { bias: number; samples: number }>
}

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
}

export default function LearnPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminToken, setAdminToken] = useState("")
  const [csvDownloading, setCsvDownloading] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/learning-summary", { cache: "no-store" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Summary
        if (!cancelled) setSummary(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "取得に失敗しました")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function downloadCsv() {
    setCsvDownloading(true)
    setCsvError(null)
    try {
      const res = await fetch("/api/admin/corrections?format=csv", {
        headers: { "x-admin-token": adminToken.trim() },
      })
      if (res.status === 401) throw new Error("管理者トークンが正しくありません")
      if (res.status === 503) throw new Error("ADMIN_TOKEN が未設定です（Vercel env で設定してください）")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `corrections-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "ダウンロードに失敗しました")
    } finally {
      setCsvDownloading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-md py-xl">
      <header className="mb-xl flex items-center justify-between">
        <div className="flex items-center gap-md">
          <Brain className="h-7 w-7 text-[var(--accent)]" aria-hidden />
          <h1 className="font-heading text-h2 font-semibold text-[var(--text-primary)]">
            学習モード
          </h1>
        </div>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-button)] px-3 text-xs font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--secondary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          診断に戻る
        </Link>
      </header>

      <p className="mb-xl text-body text-[var(--text-secondary)]">
        学習データの蓄積・ユーザー修正フィードバック・モデル改善の進捗を一覧します。
      </p>

      {/* Top metrics */}
      <section aria-label="主要メトリクス" className="mb-xl grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Tags className="h-5 w-5" />}
          label="教師ラベル総数"
          value={summary?.trainingLabels.total ?? "—"}
          loading={loading}
        />
        <MetricCard
          icon={<BookOpen className="h-5 w-5" />}
          label="累計診断数"
          value={summary?.diagnoses.total ?? "—"}
          loading={loading}
        />
        <MetricCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="修正フィードバック総数"
          value={summary?.corrections.total ?? "—"}
          sub={summary ? `直近7日: ${summary.corrections.lastWeek} / 30日: ${summary.corrections.lastMonth}` : undefined}
          loading={loading}
        />
        <MetricCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="平均絶対誤差"
          value={summary?.corrections.meanAbsoluteDelta ?? "—"}
          sub="0に近いほど判定精度が高い"
          loading={loading}
        />
      </section>

      {error && (
        <div role="alert" className="mb-xl rounded-md border border-red-300 bg-red-50 p-md text-body-sm text-red-700">
          サマリーの取得に失敗しました：{error}
        </div>
      )}

      {/* Labels by rank distribution */}
      <section aria-label="ランク別ラベル分布" className="mb-xl">
        <h2 className="mb-md font-heading text-h3 font-semibold text-[var(--text-primary)]">
          教師ラベル：ランク別分布
        </h2>
        <Card>
          <CardContent className="p-md">
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : summary ? (
              <RankDistributionBars data={summary.trainingLabels.byRank} />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Active learned bias */}
      <section aria-label="現在の学習バイアス" className="mb-xl">
        <h2 className="mb-md font-heading text-h3 font-semibold text-[var(--text-primary)]">
          現在の学習バイアス（次回判定に自動適用）
        </h2>
        <Card>
          <CardContent className="p-md">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : summary ? (
              <BiasTable data={summary.biasMap} />
            ) : null}
            <p className="mt-sm text-caption text-[var(--text-secondary)]">
              ユーザーの修正フィードバックから「AI生スコアごとの平均偏差」を算出し、次回の診断時にAIスコアへ自動加算します。1件のフィードバックでも参考に補正、|±1.5|を上限にクリップ。
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Correction delta distribution */}
      <section aria-label="修正差分の分布" className="mb-xl">
        <h2 className="mb-md font-heading text-h3 font-semibold text-[var(--text-primary)]">
          修正差分の分布（補正後ランク − 元ランク）
        </h2>
        <Card>
          <CardContent className="p-md">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : summary && summary.corrections.total === 0 ? (
              <p className="text-body-sm text-[var(--text-secondary)]">
                まだフィードバックが集まっていません。
              </p>
            ) : summary ? (
              <DeltaBars data={summary.corrections.deltaDistribution} />
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Actions */}
      <section aria-label="学習アクション" className="mb-xl grid grid-cols-1 gap-md md:grid-cols-2">
        <ActionCard
          icon={<Tags className="h-5 w-5" />}
          title="手動ラベリング"
          description="教師データを直接追加・編集します。各ランク（1〜10）に画像を割り当て。"
          action={
            <Link
              href="/labeling"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--accent)] px-4 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-[var(--accent)]/90"
            >
              ラベリングを開く
            </Link>
          }
        />
        <ActionCard
          icon={<Download className="h-5 w-5" />}
          title="フィードバックCSV出力"
          description="ユーザー修正フィードバックを集約してCSVダウンロード。再学習用ラベルに統合できます。"
          action={
            <div className="flex flex-col gap-sm">
              <input
                type="password"
                placeholder="管理者トークン (x-admin-token)"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                className="w-full rounded-md border border-[var(--muted)]/30 bg-white px-3 py-2 text-body-sm placeholder:text-[var(--text-secondary)]/60 focus:border-[var(--accent)] focus:outline-none"
                aria-label="管理者トークン"
              />
              <Button onClick={downloadCsv} disabled={!adminToken.trim() || csvDownloading} className="gap-1.5">
                <Download className="h-4 w-4" />
                {csvDownloading ? "ダウンロード中…" : "CSVをダウンロード"}
              </Button>
              {csvError && (
                <p role="alert" className="text-body-sm text-red-600">
                  {csvError}
                </p>
              )}
            </div>
          }
        />
      </section>

      <section aria-label="再学習プロセス" className="mb-xl">
        <Card>
          <CardContent className="p-lg">
            <div className="mb-sm flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--accent)]" />
              <h3 className="font-heading text-h4 font-semibold text-[var(--text-primary)]">
                再学習ワークフロー
              </h3>
            </div>
            <ol className="ml-md list-decimal space-y-1 text-body-sm text-[var(--text-secondary)]">
              <li>本ページ右側で「フィードバックCSV出力」をダウンロード</li>
              <li>明らかな誤入力をレビューして除外</li>
              <li>
                <code className="rounded bg-[var(--muted)]/15 px-1 py-0.5 text-caption">
                  training-data/labels.csv
                </code>{" "}
                に追記（photo_id を新採番、または既存IDの rank を上書き）
              </li>
              <li>
                <code className="rounded bg-[var(--muted)]/15 px-1 py-0.5 text-caption">
                  ai/precompute.py
                </code>{" "}
                を実行 → 新しい features.npz を生成
              </li>
              <li>HF Space の models/ ディレクトリを差し替えてpush</li>
              <li>本ページの「平均絶対誤差」が前月比で減れば改善が効いている指標</li>
            </ol>
          </CardContent>
        </Card>
      </section>

      {summary && (
        <p className="text-caption text-[var(--text-secondary)]">
          最終更新: {new Date(summary.generatedAt).toLocaleString("ja-JP")}
        </p>
      )}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  loading: boolean
}) {
  return (
    <Card>
      <CardContent className="p-md">
        <div className="mb-sm flex items-center gap-2 text-[var(--text-secondary)]">
          {icon}
          <span className="text-caption font-medium uppercase tracking-wider">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="font-score text-h2 font-bold tabular-nums text-[var(--text-primary)]">
            {value}
          </p>
        )}
        {sub && !loading && (
          <p className="mt-xs text-caption text-[var(--text-secondary)]">{sub}</p>
        )}
      </CardContent>
    </Card>
  )
}

function ActionCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-lg">
        <div className="mb-sm flex items-center gap-2">
          {icon}
          <h3 className="font-heading text-h4 font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
        </div>
        <p className="mb-md text-body-sm text-[var(--text-secondary)]">{description}</p>
        {action}
      </CardContent>
    </Card>
  )
}

function RankDistributionBars({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data))
  const ranks = Array.from({ length: 10 }, (_, i) => i + 1)
  return (
    <div className="grid grid-cols-10 items-end gap-1 h-32">
      {ranks.map((r) => {
        const count = data[r] ?? 0
        const heightPct = (count / max) * 100
        return (
          <div key={r} className="flex flex-col items-center gap-1">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: RANK_COLORS[r],
                  minHeight: count > 0 ? "4px" : "0",
                }}
                aria-label={`ランク${r}: ${count}件`}
              />
            </div>
            <div className="font-score tabular-nums text-caption text-[var(--text-secondary)]">
              {r}
            </div>
            <div className="font-score tabular-nums text-caption font-medium text-[var(--text-primary)]">
              {count}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BiasTable({ data }: { data: Record<string, { bias: number; samples: number }> }) {
  const ranks = Array.from({ length: 10 }, (_, i) => i + 1)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-sm">
        <thead>
          <tr className="border-b border-[var(--muted)]/20 text-caption text-[var(--text-secondary)]">
            <th className="px-2 py-2 text-left font-medium">AI生ランク</th>
            {ranks.map((r) => (
              <th key={r} className="px-2 py-2 text-center font-mono">
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-2 py-2 text-[var(--text-secondary)]">バイアス</td>
            {ranks.map((r) => {
              const e = data[r] ?? { bias: 0, samples: 0 }
              const sign = e.bias > 0 ? "+" : ""
              const color =
                e.bias > 0
                  ? "text-[var(--score-rank-8)]"
                  : e.bias < 0
                    ? "text-[var(--score-rank-3)]"
                    : "text-[var(--text-secondary)]"
              return (
                <td key={r} className={`px-2 py-2 text-center font-mono ${color}`}>
                  {e.samples > 0 ? `${sign}${e.bias}` : "—"}
                </td>
              )
            })}
          </tr>
          <tr>
            <td className="px-2 py-2 text-[var(--text-secondary)]">サンプル数</td>
            {ranks.map((r) => {
              const e = data[r] ?? { bias: 0, samples: 0 }
              return (
                <td key={r} className="px-2 py-2 text-center font-mono text-caption text-[var(--text-secondary)]">
                  {e.samples}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DeltaBars({ data }: { data: Record<string, number> }) {
  // -9..+9 range
  const buckets = Array.from({ length: 19 }, (_, i) => i - 9)
  const max = Math.max(1, ...Object.values(data))
  return (
    <div className="grid items-end gap-1 h-24" style={{ gridTemplateColumns: "repeat(19, minmax(0, 1fr))" }}>
      {buckets.map((delta) => {
        const count = data[delta] ?? 0
        const heightPct = (count / max) * 100
        const color = delta < 0 ? "var(--score-rank-3)" : delta > 0 ? "var(--score-rank-8)" : "var(--muted)"
        return (
          <div key={delta} className="flex flex-col items-center gap-1">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: color,
                  minHeight: count > 0 ? "4px" : "0",
                }}
                aria-label={`差分${delta}: ${count}件`}
              />
            </div>
            <div className="font-score tabular-nums text-caption text-[var(--text-secondary)]">
              {delta > 0 ? `+${delta}` : delta}
            </div>
          </div>
        )
      })}
    </div>
  )
}

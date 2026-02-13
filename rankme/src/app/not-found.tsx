import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-md py-3xl">
      <div className="w-full max-w-md space-y-xl text-center">
        {/* 404 */}
        <div className="font-score tabular-nums text-score-display font-bold text-[var(--muted)]">
          404
        </div>

        {/* Message */}
        <div className="space-y-sm">
          <h1 className="font-heading text-h2 font-semibold text-[var(--text-primary)]">
            ページが見つかりません
          </h1>
          <p className="text-body-sm text-[var(--text-secondary)]">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
        </div>

        {/* Back to home */}
        <Link
          href="/"
          className="inline-flex items-center gap-xs rounded-[var(--radius-button)] bg-[var(--accent)] px-xl py-md text-body-sm font-semibold text-white transition-opacity duration-fast hover:opacity-90"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          トップページへ戻る
        </Link>
      </div>
    </main>
  );
}

# DiagnosisReport コンポーネント仕様

## 概要

AI診断の完全な結果を表示するレポートコンポーネント。
顔写真、ランクスコア、改善アドバイス、免責テキストを統合的にレイアウトする。
診断レポート画面のメインコンテンツとして、ユーザーに結果を明確かつ専門的に提示する。

---

## Props Interface

```typescript
interface DiagnosisReportProps {
  /** 診断結果データ */
  result: DiagnosisResult;

  /** レポート表示のアニメーション有効化（デフォルト: true） */
  animated?: boolean;

  /** 「もう一度診断する」ボタンのコールバック */
  onRetry?: () => void;

  /** 履歴に保存するコールバック */
  onSave?: () => void;

  /** カスタムクラス名 */
  className?: string;
}

interface DiagnosisResult {
  /** 診断ID */
  id: string;

  /** アップロードされた顔写真のURL */
  imageUrl: string;

  /** ランクスコア（1-10） */
  score: number;

  /** 改善アドバイス一覧 */
  adviceItems: AdviceItem[];

  /** 診断日時 */
  diagnosedAt: string;
}

interface AdviceItem {
  /** アドバイスID */
  id: string;

  /** アドバイスのカテゴリアイコン名（Lucide Reactアイコン名） */
  icon: string;

  /** アドバイスタイトル */
  title: string;

  /** アドバイス詳細説明 */
  description: string;

  /** 優先度（表示順序に影響） */
  priority: "high" | "medium" | "low";
}
```

---

## バリアント

| バリアント | 説明 | 使用場面 |
|-----------|------|---------|
| `full` | 全要素表示（顔写真 + スコア + アドバイス + 免責 + アクション） | 診断直後のレポート画面 |
| `compact` | スコアとアドバイスのみ（顔写真なし） | 履歴からの詳細展開 |
| `summary` | スコアと顔写真のみ | 履歴一覧のカード内プレビュー |

---

## 状態

### default（デフォルト / 結果表示）

- 全セクションが表示された完全なレポート
- セクション構成（上から順に）:
  1. 顔写真（角丸8px、shadow-sm）
  2. スコア表示（ScoreDisplayコンポーネント、lg サイズ）
  3. 免責テキスト（0.75rem、セカンダリカラー）
  4. 改善アドバイスカード（3-5項目）
  5. アクションボタン（「もう一度診断する」）

### animated（アニメーション付き表示）

- motion/react によるスタガーアニメーション:
  1. 顔写真: フェードイン（delay: 0ms, duration: 200ms）
  2. スコア: フェードイン + スケール（delay: 100ms, duration: 200ms）
  3. 免責テキスト: フェードイン（delay: 200ms, duration: 150ms）
  4. アドバイスカード: 各カードが順にフェードイン（delay: 300ms + index * 50ms, duration: 100ms）
  5. アクションボタン: フェードイン（最後に表示）

### loading（ローディング / 分析中）

- 顔写真エリア: アップロード済み画像をそのまま表示（薄く表示、opacity: 0.7）
- スコアエリア: スケルトンプレースホルダー（パルスアニメーション）
- アドバイスエリア: 3つのスケルトンカード（パルスアニメーション）
- プログレステキスト: 「AI分析中...」
- プログレスバー: シンプルなリニアプログレス

### error（エラー）

- 顔写真: そのまま表示
- スコアエリア: エラーメッセージ表示
  - Lucide `AlertCircle` アイコン + 「診断に失敗しました」
  - エラー詳細テキスト（セカンダリカラー）
- アドバイスエリア: 非表示
- アクションボタン: 「再試行する」に変化

### hover（ホバー、summaryバリアント時）

- カード全体のシャドウが shadow-sm から shadow-md に変化
- transition: 150ms ease
- カーソル: pointer

### disabled（無効）

- 全体の opacity: 0.5
- インタラクション不可

---

## レイアウト構造

### モバイル（縦積みレイアウト）

```
+-------------------------------+
|                               |
|       [顔写真]                |  <- max-width: 280px, 中央配置
|       角丸8px                 |
|                               |
+-------------------------------+
|                               |
|          [Score: 7]           |  <- ScoreDisplay lg
|            /10                |
|                               |
+-------------------------------+
|  免責テキスト                   |  <- 0.75rem, セカンダリカラー
+-------------------------------+
|                               |
|  [アドバイスカード 1]           |  <- カード形式、角丸12px
|  [アドバイスカード 2]           |
|  [アドバイスカード 3]           |
|                               |
+-------------------------------+
|                               |
|    [もう一度診断する]           |  <- CTAボタン
|                               |
+-------------------------------+
```

### デスクトップ（2カラムレイアウト）

```
+-------------------+-------------------+
|                   |                   |
|   [顔写真]        |   [Score: 7]      |
|   角丸8px         |     /10           |
|                   |                   |
|                   |  免責テキスト       |
|                   |                   |
+-------------------+-------------------+
|                                       |
|  [アドバイスカード 1] [カード 2]        |
|  [アドバイスカード 3]                   |
|                                       |
+---------------------------------------+
|                                       |
|         [もう一度診断する]              |
|                                       |
+---------------------------------------+
```

---

## アドバイスカードの内部構造

```
+---------------------------------------+
| [Icon]  タイトル                        |  <- アイコン20px + DM Sans 600
|                                       |
|  説明テキスト。スキャンしやすい          |  <- Noto Sans JP 400, 0.9375rem
|  短い文章でアドバイスを提示。            |
|                                       |
+---------------------------------------+
```

- カード背景: #FFFFFF（ライト）/ #1E293B（ダーク）
- ボーダー: 1px solid #E2E8F0
- 角丸: 12px
- パディング: 16px-24px
- アイコンカラー: アクセントカラー (#0891B2)

---

## アクセシビリティ要件

- レポート全体を `<article>` タグで囲み、`aria-label="診断レポート"` を設定
- 顔写真に `alt="診断対象の顔写真"` を設定
- ScoreDisplay コンポーネントの `aria-label` で完全なスコア説明を提供
- 各アドバイスカードに `role="listitem"` を適用し、アドバイスリスト全体を `role="list"` で囲む
- 免責テキストに `role="note"` を適用
- 「もう一度診断する」ボタンに明確な `aria-label` を設定
- ローディング状態で `aria-busy="true"` を設定し、`aria-live="polite"` で完了を通知
- エラー状態で `role="alert"` を適用
- キーボードナビゲーション: Tab キーでアドバイスカード間を移動可能
- フォーカスインジケータ: 2px solid #0891B2 のアウトライン
- カラーだけに依存しないスコア伝達: 数値テキスト + カラーの併用

---

## 使用例

```tsx
{/* 診断完了後の全表示 */}
<DiagnosisReport
  result={{
    id: "diag-001",
    imageUrl: "/uploads/face-001.webp",
    score: 7,
    adviceItems: [
      {
        id: "adv-1",
        icon: "Smile",
        title: "表情の印象",
        description: "自然な笑顔が好印象です。口角をやや上げた表情を維持すると、さらに評価が向上する可能性があります。",
        priority: "high",
      },
      {
        id: "adv-2",
        icon: "Sun",
        title: "肌のコンディション",
        description: "肌の均一性は良好です。紫外線対策を継続することで、長期的なスコア維持に繋がります。",
        priority: "medium",
      },
      {
        id: "adv-3",
        icon: "Scissors",
        title: "ヘアスタイル",
        description: "顔の輪郭に対してバランスの良いスタイルです。前髪の長さを微調整することで、さらに最適化できます。",
        priority: "medium",
      },
    ],
    diagnosedAt: "2026-02-13T10:30:00Z",
  }}
  animated
  onRetry={() => router.push("/")}
/>

{/* ローディング中 */}
<DiagnosisReport
  result={null}
  animated={false}
/>

{/* 履歴からの詳細展開（コンパクト） */}
<DiagnosisReport
  result={historyItem}
  animated={false}
  variant="compact"
  onRetry={() => router.push("/")}
/>

{/* サマリー表示（履歴カード内） */}
<DiagnosisReport
  result={historyItem}
  variant="summary"
  className="cursor-pointer"
/>
```

---

## 技術スタック

- **コンポーネント基盤**: React FCコンポーネント（shadcn/ui Card ベース）
- **子コンポーネント**: ScoreDisplay, AdviceCard（内部コンポーネント）
- **スタイリング**: Tailwind CSS + `cn()` ユーティリティ
- **アイコン**: Lucide React（動的インポート対応）
- **アニメーション**: motion/react（`AnimatePresence`, `motion.div`, `staggerChildren`）
- **レスポンシブ**: Tailwind breakpoints（sm, md, lg）
- **画像最適化**: Next.js `<Image>` コンポーネント（WebP/AVIF対応）

---

*Generated by CCAGI SDK - Phase 2: Component Spec*

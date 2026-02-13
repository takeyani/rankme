# RankMe コンポーネントライブラリ

Phase 2 設計ドキュメント - コンポーネントライブラリ構成定義。
`design-system.yml` および `design-requirements.md` に基づくコンポーネント設計。

---

## 1. 基盤設定

### 1.1 shadcn/ui 設定

shadcn/uiをコピーペースト方式で導入し、RankMeのclinical-professionalテーマでカスタマイズする。

```bash
# shadcn/ui 初期化
npx shadcn@latest init

# 必要コンポーネントの追加
npx shadcn@latest add button card dialog progress skeleton select table
```

```json
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### 1.2 Tailwind CSS 設定

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: "hsl(var(--surface))",
        // RankMe スコアカラー
        score: {
          1: "#DC2626",
          2: "#EA580C",
          3: "#D97706",
          4: "#CA8A04",
          5: "#A3A30A",
          6: "#65A30D",
          7: "#16A34A",
          8: "#059669",
          9: "#0891B2",
          10: "#0284C7",
        },
      },
      fontFamily: {
        heading: ["DM Sans", "system-ui", "sans-serif"],
        body: ["Noto Sans JP", "system-ui", "sans-serif"],
        score: ["DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        score: ["5rem", { lineHeight: "1", fontWeight: "700" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
        "2xl": "48px",
        "3xl": "64px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
        md: "0 4px 6px rgba(0, 0, 0, 0.1)",
        lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
        xl: "0 20px 25px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 1.3 CSS変数設定

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500&display=swap");

@layer base {
  :root {
    --background: 210 40% 98%;        /* #F8FAFC */
    --foreground: 215 28% 17%;        /* #1E293B */
    --surface: 0 0% 100%;             /* #FFFFFF */

    --primary: 213 14% 13%;           /* #1C2127 */
    --primary-foreground: 210 40% 98%;

    --secondary: 210 40% 98%;         /* #F8FAFC */
    --secondary-foreground: 215 28% 17%;

    --accent: 189 94% 37%;            /* #0891B2 */
    --accent-foreground: 0 0% 100%;

    --muted: 215 16% 62%;             /* #94A3B8 */
    --muted-foreground: 215 16% 47%;

    --destructive: 0 72% 51%;         /* #DC2626 */
    --destructive-foreground: 0 0% 100%;

    --border: 214 32% 91%;            /* #E2E8F0 */
    --input: 214 32% 91%;
    --ring: 189 94% 37%;

    --radius: 8px;
  }

  .dark {
    --background: 222 47% 11%;        /* #0F172A */
    --foreground: 210 40% 96%;        /* #F1F5F9 */
    --surface: 215 28% 17%;           /* #1E293B */

    --primary: 210 40% 96%;
    --primary-foreground: 222 47% 11%;

    --secondary: 215 28% 17%;
    --secondary-foreground: 210 40% 96%;

    --accent: 187 92% 69%;            /* #22D3EE */
    --accent-foreground: 222 47% 11%;

    --muted: 215 16% 62%;
    --muted-foreground: 215 20% 65%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;

    --border: 217 19% 27%;            /* #334155 */
    --input: 217 19% 27%;
    --ring: 187 92% 69%;
  }
}

@layer base {
  body {
    @apply bg-background text-foreground font-body;
  }

  h1, h2, h3, h4 {
    @apply font-heading;
  }
}
```

### 1.4 cn ユーティリティ

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## 2. 必須コンポーネント一覧

| コンポーネント | shadcn/uiベース | カスタマイズ | 用途 |
|---------------|----------------|-------------|------|
| UploadDropzone | - | カスタム | 顔写真アップロードエリア |
| ScoreDisplay | - | カスタム | ランクスコア表示（1-10） |
| AdviceCard | Card | 拡張 | 改善アドバイス表示 |
| DiagnosisReport | - | カスタム | 診断レポート全体レイアウト |
| HistoryTable | Table | 拡張 | 診断履歴一覧 |
| LabelingGrid | - | カスタム | 教師データラベリングUI |
| RankSelector | Select | 拡張 | ランク1-10選択UI |
| ImagePreview | - | カスタム | 顔写真プレビュー表示 |
| Button | Button | テーマ適用 | CTA、アクションボタン |
| Dialog | Dialog | テーマ適用 | 確認ダイアログ |
| Progress | Progress | テーマ適用 | ローディング進捗表示 |
| Skeleton | Skeleton | テーマ適用 | ローディングプレースホルダー |
| DisclaimerText | - | カスタム | 免責テキスト表示 |

---

## 3. コンポーネント詳細

### 3.1 UploadDropzone

顔写真のドラッグ&ドロップまたはクリック選択に対応するアップロードコンポーネント。

#### Props

```typescript
interface UploadDropzoneProps {
  /** ファイル選択時のコールバック */
  onFileSelect: (file: File) => void;
  /** 受け付けるファイル形式 */
  accept?: string;
  /** 最大ファイルサイズ（バイト） */
  maxSize?: number;
  /** 無効状態 */
  disabled?: boolean;
  /** ローディング状態 */
  isLoading?: boolean;
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<UploadDropzone
  onFileSelect={(file) => handleUpload(file)}
  accept="image/jpeg,image/png,image/webp"
  maxSize={10 * 1024 * 1024}
/>
```

#### バリアント

| 状態 | 外観 |
|------|------|
| デフォルト | ダッシュ枠線 + Uploadアイコン + テキスト |
| ドラッグオーバー | ボーダーカラーがアクセント色に変化 |
| ファイル選択済み | サムネイルプレビュー表示 |
| 無効 | グレーアウト、操作不可 |
| ローディング | パルスアニメーション |

---

### 3.2 ScoreDisplay

ランクスコア（1-10）を大きく表示するコンポーネント。医療検査結果のような明快な数値表示。

#### Props

```typescript
interface ScoreDisplayProps {
  /** ランクスコア（1-10） */
  score: number;
  /** アニメーション有効化 */
  animated?: boolean;
  /** 表示サイズ */
  size?: "sm" | "md" | "lg";
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<ScoreDisplay score={8} animated size="lg" />
```

#### バリアント

| サイズ | フォントサイズ | 用途 |
|--------|-------------|------|
| sm | 2rem | 履歴一覧のインライン表示 |
| md | 3.5rem | カード内表示 |
| lg | 5rem | 診断レポートのメイン表示 |

スコアに応じて `score.rank_1` - `score.rank_10` のカラーが自動適用される。
アニメーションが有効な場合、motion/reactによるフェードイン + スケール (0.95 -> 1.0) で結果を提示する。

---

### 3.3 AdviceCard

改善アドバイスを1項目ずつ表示するカードコンポーネント。shadcn/uiのCardを拡張。

#### Props

```typescript
interface AdviceCardProps {
  /** アイコン（Lucide React） */
  icon: React.ReactNode;
  /** アドバイスタイトル */
  title: string;
  /** アドバイス説明文 */
  description: string;
  /** 優先度（表示順序に影響） */
  priority?: "high" | "medium" | "low";
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<AdviceCard
  icon={<Camera className="h-5 w-5" />}
  title="照明の改善"
  description="自然光の下で撮影すると、より正確な診断結果が得られます。"
  priority="high"
/>
```

#### バリアント

| 優先度 | 左ボーダー色 |
|--------|-------------|
| high | accent (#0891B2) |
| medium | accent_secondary (#059669) |
| low | muted (#94A3B8) |

---

### 3.4 DiagnosisReport

診断レポート全体のレイアウトを構成するコンポーネント。顔写真、スコア、アドバイスを統合表示。

#### Props

```typescript
interface DiagnosisReportProps {
  /** 顔写真URL */
  imageUrl: string;
  /** ランクスコア */
  score: number;
  /** 改善アドバイス一覧 */
  advices: AdviceItem[];
  /** 診断日時 */
  diagnosedAt: Date;
  /** カスタムクラス */
  className?: string;
}

interface AdviceItem {
  icon: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
```

#### 使用例

```tsx
<DiagnosisReport
  imageUrl="/uploads/face-001.webp"
  score={7}
  advices={adviceList}
  diagnosedAt={new Date()}
/>
```

#### レスポンシブレイアウト

| 画面サイズ | レイアウト |
|-----------|----------|
| mobile | 縦積み: 顔写真 -> スコア -> アドバイス |
| tablet (md) | 2カラム: 顔写真+スコア / アドバイス |
| desktop (lg) | 2カラム + サイドパネル |

---

### 3.5 HistoryTable

診断履歴をテーブル形式で表示するコンポーネント。shadcn/uiのTableを拡張。

#### Props

```typescript
interface HistoryTableProps {
  /** 診断履歴データ */
  data: DiagnosisHistory[];
  /** ソート順 */
  sortBy?: "date" | "score";
  /** ソート方向 */
  sortOrder?: "asc" | "desc";
  /** ページネーション */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  /** カスタムクラス */
  className?: string;
}

interface DiagnosisHistory {
  id: string;
  thumbnailUrl: string;
  score: number;
  diagnosedAt: Date;
}
```

#### 使用例

```tsx
<HistoryTable
  data={historyData}
  sortBy="date"
  sortOrder="desc"
  pagination={{ page: 1, pageSize: 20, total: 100 }}
/>
```

#### レスポンシブ対応

| 画面サイズ | 表示形式 |
|-----------|---------|
| mobile | カードリスト |
| tablet (md) | 2カラムグリッド |
| desktop (lg) | テーブル表示 |

---

### 3.6 LabelingGrid

教師データのラベリング作業用グリッドコンポーネント。効率的な一括操作をサポート。

#### Props

```typescript
interface LabelingGridProps {
  /** 画像データ一覧 */
  images: LabelingImage[];
  /** ランク変更コールバック */
  onRankChange: (imageId: string, rank: number) => void;
  /** 一括操作コールバック */
  onBulkAction?: (imageIds: string[], rank: number) => void;
  /** フィルター設定 */
  filter?: {
    rankRange?: [number, number];
    dateRange?: [Date, Date];
    labeled?: boolean;
  };
  /** カスタムクラス */
  className?: string;
}

interface LabelingImage {
  id: string;
  url: string;
  currentRank?: number;
  labeledAt?: Date;
}
```

#### 使用例

```tsx
<LabelingGrid
  images={trainingImages}
  onRankChange={(id, rank) => updateLabel(id, rank)}
  onBulkAction={(ids, rank) => bulkUpdate(ids, rank)}
  filter={{ labeled: false }}
/>
```

#### レスポンシブ対応

| 画面サイズ | カラム数 |
|-----------|---------|
| mobile | カードリスト + スコア入力 |
| tablet (md) | 3カラムグリッド |
| desktop (lg) | 4-6カラムグリッド + サイドパネル |

#### キーボードショートカット

| キー | アクション |
|------|----------|
| 1-9, 0 | ランク設定（0は10） |
| Tab | 次の画像へ |
| Shift+Tab | 前の画像へ |
| Space | 選択/選択解除 |
| Ctrl+A | 全選択 |

---

### 3.7 RankSelector

ランク1-10を選択するセレクターコンポーネント。shadcn/uiのSelectを拡張。

#### Props

```typescript
interface RankSelectorProps {
  /** 現在のランク値 */
  value?: number;
  /** ランク変更コールバック */
  onChange: (rank: number) => void;
  /** 表示モード */
  variant?: "dropdown" | "inline";
  /** 無効状態 */
  disabled?: boolean;
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<RankSelector
  value={7}
  onChange={(rank) => setRank(rank)}
  variant="inline"
/>
```

#### バリアント

| バリアント | 外観 |
|-----------|------|
| dropdown | ドロップダウン形式。各選択肢にスコアカラー表示 |
| inline | 横並びの数字ボタン。選択中のランクがスコアカラーで強調 |

---

### 3.8 ImagePreview

顔写真をクリーンに表示するコンポーネント。

#### Props

```typescript
interface ImagePreviewProps {
  /** 画像URL */
  src: string;
  /** 代替テキスト */
  alt: string;
  /** 表示サイズ */
  size?: "sm" | "md" | "lg";
  /** アスペクト比 */
  aspectRatio?: "square" | "portrait";
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<ImagePreview
  src="/uploads/face-001.webp"
  alt="診断対象の顔写真"
  size="lg"
  aspectRatio="portrait"
/>
```

#### バリアント

| サイズ | 寸法 | 用途 |
|--------|------|------|
| sm | 64x64px | 履歴一覧のサムネイル |
| md | 160x200px | ラベリンググリッド |
| lg | 320x400px | 診断レポートのメイン表示 |

---

### 3.9 DisclaimerText

免責テキストを表示するコンポーネント。

#### Props

```typescript
interface DisclaimerTextProps {
  /** カスタムテキスト（省略時はデフォルト文言） */
  text?: string;
  /** カスタムクラス */
  className?: string;
}
```

#### 使用例

```tsx
<DisclaimerText />
```

#### デフォルト文言

「本判定は、選別済み画像データとの類似度および傾向分析に基づく客観的結果です。個人の価値や魅力を断定するものではありません。」

スタイル: `text-xs text-muted-foreground` (0.75rem、セカンダリテキストカラー)

---

### 3.10 テーマ適用済みshadcn/uiコンポーネント

以下のshadcn/uiコンポーネントは、CSS変数によりRankMeテーマが自動適用される。

#### Button

```tsx
// バリアント
<Button variant="default">診断する</Button>      {/* アクセントカラー背景 */}
<Button variant="secondary">もう一度</Button>     {/* セカンダリ背景 */}
<Button variant="outline">キャンセル</Button>      {/* ボーダーのみ */}
<Button variant="ghost">詳細</Button>             {/* 背景なし */}
<Button variant="destructive">削除</Button>        {/* 赤背景 */}
```

#### Dialog

確認ダイアログ。角丸16px、shadow-md適用。

#### Progress

ローディング進捗。アクセントカラーのプログレスバー。AI分析中の進捗表示に使用。

#### Skeleton

コンテンツ読み込み中のプレースホルダー。背景はmutedカラー。

---

## 4. テーマ設定

### 4.1 CSS変数マッピング

| Tailwindトークン | ライトモード | ダークモード | 用途 |
|-----------------|------------|------------|------|
| `--background` | #F8FAFC | #0F172A | ページ背景 |
| `--foreground` | #1E293B | #F1F5F9 | プライマリテキスト |
| `--surface` | #FFFFFF | #1E293B | カード・入力フィールド背景 |
| `--primary` | #1C2127 | #F1F5F9 | 主要要素 |
| `--secondary` | #F8FAFC | #1E293B | セカンダリ要素 |
| `--accent` | #0891B2 | #22D3EE | アクセント・CTA |
| `--muted` | #94A3B8 | #94A3B8 | 補助テキスト |
| `--destructive` | #DC2626 | #DC2626 | エラー・削除 |
| `--border` | #E2E8F0 | #334155 | ボーダー |

### 4.2 ダークモード切り替え

```typescript
// Tailwind darkバリアントを使用
// システム環境設定を自動検出

// next-themes による制御
import { ThemeProvider } from "next-themes";

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

### 4.3 スコアカラーのダークモード対応

スコアカラー（ランク1-10）はライト/ダークモードで同一色を使用する。ただし、背景色とのコントラスト比を確保するため、ダークモードではやや明度を上げた値を検討する。

| ランク | ライト/ダーク共通 | 備考 |
|--------|-----------------|------|
| 1 | #DC2626 | 赤はどちらの背景でも十分なコントラスト |
| 4-5 | #CA8A04 / #A3A30A | 黄色系はダーク背景でコントラスト要検証 |
| 10 | #0284C7 | 青はどちらの背景でも十分なコントラスト |

---

## 5. フォント読み込み

```typescript
// src/app/layout.tsx (Next.js App Router)
import { DM_Sans, Noto_Sans_JP } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${dmSans.variable} ${notoSansJP.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

---

## 6. ディレクトリ構成

```
src/components/
├── ui/                      # shadcn/ui テーマ適用済み
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── progress.tsx
│   ├── select.tsx
│   ├── skeleton.tsx
│   └── table.tsx
├── diagnosis/               # 診断関連カスタムコンポーネント
│   ├── upload-dropzone.tsx
│   ├── score-display.tsx
│   ├── advice-card.tsx
│   ├── diagnosis-report.tsx
│   ├── disclaimer-text.tsx
│   └── image-preview.tsx
├── history/                 # 履歴関連
│   └── history-table.tsx
└── labeling/                # ラベリング関連
    ├── labeling-grid.tsx
    └── rank-selector.tsx
```

---

*Generated by CCAGI SDK - Phase 2: Design*

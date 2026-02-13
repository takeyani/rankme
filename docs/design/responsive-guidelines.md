# RankMe レスポンシブガイドライン

Phase 2 設計ドキュメント - レスポンシブデザインガイドライン。
`design-system.yml` および `design-requirements.md` に基づくレスポンシブ設計。

---

## 1. 設計方針

### 1.1 モバイルファースト

RankMeはモバイルファーストで設計する。一般ユーザーがスマートフォンで自撮りを撮影し、そのままスコアリングする利用シーンが最も多いと想定するため、モバイル体験を最優先とする。

- CSS記述は `min-width` 方式（Tailwind標準）
- 基本スタイルはモバイル向け、ブレークポイントで拡張

### 1.2 コンテンツ優先

- 顔写真とランクスコアが画面の主役。デバイスサイズに関わらず、これらが最も目立つように配置する
- ナビゲーションやUIクローム（装飾的要素）はコンテンツの邪魔にならない最小限に留める

---

## 2. ブレークポイント定義

| 名前 | 幅 | Tailwindプレフィックス | 対象デバイス | 主要レイアウト |
|------|-----|---------------------|-------------|--------------|
| base | 0px - 639px | (なし) | スマートフォン (375px+) | シングルカラム |
| sm | 640px+ | `sm:` | 大型スマートフォン | シングルカラム（余白拡大） |
| md | 768px+ | `md:` | タブレット | 2カラム（一部画面） |
| lg | 1024px+ | `lg:` | デスクトップ | フルレイアウト + サイドバー |
| xl | 1280px+ | `xl:` | 大型デスクトップ | ワイドレイアウト |
| 2xl | 1536px+ | `2xl:` | 超大型ディスプレイ | 最大幅制約付きワイド |

### 最大コンテンツ幅

```css
/* メインコンテンツの最大幅 */
.container {
  max-width: 1280px;  /* xl */
  margin: 0 auto;
  padding: 0 16px;    /* モバイル時 */
}

@media (min-width: 640px) {
  .container {
    padding: 0 24px;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 0 32px;
  }
}
```

Tailwindでの記述:

```tsx
<div className="mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
  {children}
</div>
```

---

## 3. 画面別レスポンシブ設計

### 3.1 トップ/アップロード画面

| 要素 | mobile (base) | tablet (md) | desktop (lg) |
|------|--------------|-------------|-------------|
| レイアウト | シングルカラム | シングルカラム（中央寄せ） | 中央配置、max-width: 640px |
| ヘッダー | ロゴ + ハンバーガー | ロゴ + ナビリンク | ロゴ + ナビリンク |
| アップロードエリア | 幅100%、高さ200px | 幅100%、高さ240px | 幅640px、高さ280px |
| CTAボタン | 幅100% | 幅auto、min-width: 200px | 幅auto、min-width: 200px |
| 説明テキスト | 本文サイズ (1rem) | 本文サイズ (1rem) | 本文大サイズ (1.125rem) |

```tsx
{/* アップロード画面レスポンシブ例 */}
<div className="mx-auto max-w-lg px-4 sm:px-6">
  <UploadDropzone className="h-[200px] md:h-[240px] lg:h-[280px]" />
  <Button className="mt-4 w-full md:w-auto md:min-w-[200px]">
    診断する
  </Button>
</div>
```

### 3.2 診断中画面

| 要素 | mobile (base) | tablet (md) | desktop (lg) |
|------|--------------|-------------|-------------|
| レイアウト | 中央配置 | 中央配置 | 中央配置 |
| プログレスバー | 幅100% | 幅80% | 幅50%、max-width: 400px |
| テキスト | 本文サイズ | 本文サイズ | 本文大サイズ |

### 3.3 診断レポート画面

| 要素 | mobile (base) | tablet (md) | desktop (lg) |
|------|--------------|-------------|-------------|
| レイアウト | 縦積み1カラム | 2カラム | 2カラム + サイドパネル |
| 顔写真 | 幅100%、max-width: 320px | 左カラム、幅50% | 左カラム、固定幅320px |
| スコア表示 | 3.5rem | 4rem | 5rem |
| アドバイスカード | 縦積み、幅100% | 右カラム、幅50% | 右カラム、幅auto |
| 免責テキスト | 0.75rem | 0.75rem | 0.75rem |

```tsx
{/* 診断レポートレスポンシブ例 */}
<div className="mx-auto max-w-screen-lg px-4">
  <div className="flex flex-col md:flex-row md:gap-8">
    {/* 左カラム: 顔写真 + スコア */}
    <div className="mx-auto max-w-[320px] md:mx-0 md:w-1/2 lg:w-auto lg:flex-shrink-0">
      <ImagePreview src={imageUrl} alt="診断対象" size="lg" />
      <ScoreDisplay
        score={score}
        animated
        className="mt-4 text-4xl md:text-5xl lg:text-score"
      />
      <DisclaimerText className="mt-2" />
    </div>

    {/* 右カラム: アドバイス */}
    <div className="mt-6 md:mt-0 md:w-1/2 lg:flex-1">
      {advices.map((advice, i) => (
        <AdviceCard key={i} {...advice} className="mb-3" />
      ))}
    </div>
  </div>
</div>
```

### 3.4 履歴一覧画面

| 要素 | mobile (base) | tablet (md) | desktop (lg) |
|------|--------------|-------------|-------------|
| レイアウト | カードリスト | 2カラムグリッド | テーブル表示 |
| サムネイル | 48x48px | 56x56px | 64x64px |
| スコア表示 | 1.5rem | 1.5rem | 2rem |
| ソートUI | ドロップダウン | ドロップダウン | カラムヘッダークリック |
| ページネーション | シンプル（前/次） | 番号付き | 番号付き + 件数表示 |

```tsx
{/* 履歴一覧レスポンシブ切り替え */}
<div className="mx-auto max-w-screen-lg px-4">
  {/* モバイル: カードリスト */}
  <div className="space-y-3 lg:hidden">
    {data.map((item) => (
      <HistoryCard key={item.id} {...item} />
    ))}
  </div>

  {/* デスクトップ: テーブル */}
  <div className="hidden lg:block">
    <HistoryTable data={data} />
  </div>
</div>
```

### 3.5 ラベリング管理画面

| 要素 | mobile (base) | tablet (md) | desktop (lg) |
|------|--------------|-------------|-------------|
| グリッドカラム | 1カラム（カード形式） | 3カラム | 4-6カラム |
| 画像サイズ | 幅100% | 160x200px | 160x200px |
| ランクセレクター | ドロップダウン | インラインボタン | インラインボタン |
| サイドパネル | なし（下部に表示） | なし | 右サイドパネル（フィルター・統計） |
| 一括操作バー | 画面下部固定 | 画面下部固定 | 上部ツールバー |

```tsx
{/* ラベリンググリッドのレスポンシブ */}
<div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
  {images.map((image) => (
    <LabelingCard key={image.id} {...image} />
  ))}
</div>
```

---

## 4. タッチターゲット

### 4.1 最小サイズ

WCAG 2.1準拠のため、すべてのインタラクティブ要素は最小 **44x44px** のタッチターゲットを確保する。

| 要素 | 最小サイズ | 推奨サイズ | 備考 |
|------|----------|----------|------|
| ボタン（CTA） | 44px | 48px | 「診断する」等の主要ボタン |
| ボタン（セカンダリ） | 44px | 44px | 「もう一度」等 |
| リンク | 44px | 44px | テキストリンクもタップ領域を確保 |
| ラベリングランクボタン | 44px | 48px | 数字選択ボタン |
| テーブル行 | 44px | 48px | 行タップで詳細表示 |
| ナビゲーション項目 | 44px | 48px | ヘッダーナビ |
| アップロードエリア | - | 200px+ | エリア全体がタップ対象 |

### 4.2 実装例

```tsx
{/* タッチターゲットの確保 */}
<Button className="min-h-[48px] min-w-[48px] px-6 py-3">
  診断する
</Button>

{/* テキストリンクのタップ領域拡大 */}
<a className="inline-flex min-h-[44px] items-center py-2">
  履歴を見る
</a>

{/* ラベリングのランク選択ボタン */}
<button className="flex h-[48px] w-[48px] items-center justify-center rounded-md">
  {rank}
</button>
```

### 4.3 間隔

タッチターゲット間の最小間隔は **8px** を確保し、誤タップを防止する。

---

## 5. モバイル固有のレイアウト

### 5.1 Safe Area対応

iPhone notch、Dynamic Island、ホームバーに対応するため `env(safe-area-inset-*)` を使用する。

```css
/* globals.css */
@supports (padding: env(safe-area-inset-top)) {
  .safe-area-top {
    padding-top: env(safe-area-inset-top);
  }

  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }

  .safe-area-inset {
    padding-top: env(safe-area-inset-top);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
  }
}
```

```html
<!-- viewport meta -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### 5.2 モバイルナビゲーション

| 要素 | 配置 | 動作 |
|------|------|------|
| ヘッダー | 上部固定 | ロゴ + ハンバーガーメニュー |
| メニュー | 右からスライドイン | オーバーレイ表示 |
| 一括操作バー | 下部固定 | ラベリング画面で表示 |

```tsx
{/* モバイルヘッダー */}
<header className="safe-area-top fixed inset-x-0 top-0 z-50 border-b border-border bg-background/95 backdrop-blur lg:hidden">
  <div className="flex h-14 items-center justify-between px-4">
    <Logo />
    <button className="flex h-[44px] w-[44px] items-center justify-center">
      <Menu className="h-5 w-5" />
    </button>
  </div>
</header>
```

### 5.3 モバイルでのスクロール動作

- 診断レポート画面: 顔写真+スコアは上部固定（sticky）、アドバイスリストはスクロール可能
- ラベリング画面: 無限スクロールまたはページネーション（メモリ節約）
- 履歴画面: プルトゥリフレッシュ対応を検討

### 5.4 モバイルでの入力最適化

| 操作 | 最適化 |
|------|--------|
| 写真アップロード | カメラ直接起動オプション (`capture="user"`) |
| ランク選択 | ネイティブセレクトの代わりにインラインボタン |
| フィルター | ボトムシート形式のフィルターUI |

```tsx
{/* カメラ起動対応のファイル入力 */}
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="user"
  className="hidden"
/>
```

---

## 6. 画像ハンドリング

### 6.1 画像フォーマット

| フォーマット | 用途 | 備考 |
|-------------|------|------|
| WebP | 標準表示 | 全ブラウザ対応 |
| AVIF | 高圧縮表示 | 対応ブラウザで優先使用 |
| JPEG | フォールバック | 非対応ブラウザ用 |

### 6.2 レスポンシブ画像

Next.jsの `<Image>` コンポーネントを使用し、デバイスに応じた最適なサイズを配信する。

```tsx
import Image from "next/image";

{/* 診断レポートの顔写真 */}
<Image
  src={imageUrl}
  alt="診断対象の顔写真"
  width={320}
  height={400}
  sizes="(max-width: 768px) 100vw, 320px"
  className="rounded-lg object-cover"
  priority
/>
```

### 6.3 画面サイズ別の画像サイズ

| 画面 | コンポーネント | mobile | tablet | desktop |
|------|-------------|--------|--------|---------|
| 診断レポート | ImagePreview (lg) | 幅100%, max 320px | 幅50%, max 320px | 320x400px |
| 履歴一覧 | サムネイル | 48x48px | 56x56px | 64x64px |
| ラベリング | グリッド画像 | 幅100% | 160x200px | 160x200px |
| アップロード | プレビュー | 幅100%, max 280px | 幅100%, max 320px | 320x400px |

### 6.4 画像プレースホルダー

CLS (Cumulative Layout Shift) を防止するため、画像の表示領域は事前にサイズを確保する。

```tsx
{/* CLS防止のアスペクト比固定 */}
<div className="relative aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-lg bg-muted">
  <Image
    src={imageUrl}
    alt="診断対象"
    fill
    className="object-cover"
    sizes="320px"
  />
</div>
```

### 6.5 画像の遅延読み込み

- 診断レポートのメイン顔写真: `priority` (即時読み込み、LCPに影響)
- 履歴一覧のサムネイル: `loading="lazy"` (ビューポート外は遅延)
- ラベリンググリッド: `loading="lazy"` + Intersection Observer

---

## 7. タイポグラフィのレスポンシブ対応

### 7.1 フォントサイズ

| 要素 | mobile | tablet (md) | desktop (lg) |
|------|--------|-------------|-------------|
| H1 | 1.875rem | 2.25rem | 2.5rem |
| H2 | 1.5rem | 1.75rem | 2rem |
| H3 | 1.25rem | 1.375rem | 1.5rem |
| H4 | 1.125rem | 1.125rem | 1.25rem |
| 本文 | 1rem | 1rem | 1rem |
| スコア表示 | 3.5rem | 4rem | 5rem |
| キャプション | 0.75rem | 0.75rem | 0.75rem |

```tsx
{/* レスポンシブなスコア表示 */}
<span className="font-score text-[3.5rem] font-bold md:text-[4rem] lg:text-score">
  {score}
</span>
<span className="ml-1 text-lg text-muted-foreground md:text-xl">/10</span>
```

### 7.2 行間・文字間隔

| 要素 | line-height | letter-spacing |
|------|------------|---------------|
| 見出し | 1.2 | -0.02em |
| 本文 | 1.7 | 0 |
| スコア | 1.0 | -0.04em |
| キャプション | 1.5 | 0.02em |

---

## 8. パフォーマンス考慮事項

### 8.1 レスポンシブ画像の最適化

- `srcset` と `sizes` を適切に設定し、不要に大きい画像のダウンロードを防止
- サムネイルは専用のリサイズ済み画像を使用（オリジナル画像を縮小表示しない）

### 8.2 コンポーネントの遅延読み込み

```tsx
import dynamic from "next/dynamic";

// ラベリング画面は管理者のみ使用するため遅延読み込み
const LabelingGrid = dynamic(() => import("@/components/labeling/labeling-grid"), {
  loading: () => <Skeleton className="h-96 w-full" />,
});
```

### 8.3 ブレークポイント別のコンポーネント出し分け

履歴画面のテーブル/カード切り替えなど、レスポンシブで大きくレイアウトが変わる場合はCSS (`hidden`/`block`) で制御する。JavaScriptによるウィンドウサイズ検出は避ける。

```tsx
{/* CSS制御による出し分け（JSによるリサイズ検出は不使用） */}
<div className="lg:hidden">{/* モバイル/タブレット用 */}</div>
<div className="hidden lg:block">{/* デスクトップ用 */}</div>
```

---

*Generated by CCAGI SDK - Phase 2: Design*

# Bulk Import — 全写真を一括判定

`training-data/` 配下のすべての写真をAI（HF Spaces）に判定させ、Supabase Storage にアップロードして `TrainingLabel` テーブルに登録します。これで `/labeling` から全写真をレビュー・修正できる状態になります。

## 前提

- Vercel に `rankme` プロジェクトが連携済み（Supabase Marketplace 経由）
- ローカルに 1000枚 規模の写真が `training-data/` 配下にある

## 手順

### 1. 環境変数を取得

```bash
vercel env pull .env.production.local --environment=production
```

`.env.production.local` に以下が含まれていることを確認:

- `POSTGRES_PRISMA_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. 実行

```bash
npm run bulk-import
# または対象ディレクトリを明示:
node scripts/bulk-import.mjs ./training-data
```

`AI_SERVICE_URL` 環境変数で AI エンドポイントを上書き可能。デフォルトは `https://takeyani-rankme-ai.hf.space`。

### 3. 進捗

各ファイルごとに `[N/total] path → rank=X` を出力。最後にサマリー（新規/スキップ/失敗）。

## 冪等性

- 同じ画像コンテンツ（SHA256ハッシュの先頭16文字）はSupabase上で同一パスにアップロードされ、`TrainingLabel.imageUrl` にそのハッシュが含まれる
- 再実行すると既存ハッシュは検出されてスキップ
- 失敗したファイルだけ再試行できる

## 想定所要時間

1000枚 × 約3秒/枚（アップロード + AI推論 + DB保存）→ **約50分**

## トラブルシュート

| 症状 | 対処 |
|---|---|
| `必須env未設定` | `.env.production.local` を `vercel env pull` で取得 |
| `Bucket creation failed: 401` | Service Role Key が間違っている。Supabase ダッシュボードから再取得 |
| `AI predict failed (502)` | HF Spaces が cold start 中。30秒待って再実行 |
| 特定写真だけ失敗 | EXIF/壊れたファイルの可能性。スキップして続行される |

## インポート後

- `/labeling` で全写真がランクごとに見える
- AIの初期判定に違和感があるものは、各カードから手動で修正可能
- 修正は `TrainingLabel` の rank 更新（既存の `/api/labels` 経由）
- 蓄積された修正は学習バイアス（`/learn` で確認）にも自動反映

# RankMe API Reference

RankMe プロジェクトの API リファレンスドキュメントです。

## 目次

- [概要](#概要)
- [共通仕様](#共通仕様)
- [エンドポイント一覧](#エンドポイント一覧)
  - [POST /api/diagnose](#post-apidiagnose)
  - [GET /api/health](#get-apihealth)
  - [GET /api/history](#get-apihistory)
  - [GET /api/history/[id]](#get-apihistoryid)
  - [GET /api/labels](#get-apilabels)
  - [POST /api/labels](#post-apilabels)
  - [PUT /api/labels/[id]](#put-apilabelsid)
  - [DELETE /api/labels/[id]](#delete-apilabelsid)
- [AI Service（FastAPI）](#ai-servicefastapi)
  - [POST /predict](#post-predict)
  - [GET /health](#get-health)
- [エラーコード一覧](#エラーコード一覧)

---

## 概要

RankMe API は、画像をAI推論サービスに送信してランク診断を行い、改善アドバイスを生成するRESTful APIです。

| 項目 | 値 |
|------|-----|
| ベースURL | `http://localhost:3000` |
| プロトコル | HTTP/HTTPS |
| レスポンス形式 | JSON |
| データベース | PostgreSQL（Prisma ORM） |
| AI推論サービス | FastAPI（ポート 8000） |

---

## 共通仕様

### リクエストヘッダー

| ヘッダー | 値 | 備考 |
|---------|-----|------|
| `Content-Type` | `application/json` | JSON送信時 |
| `Content-Type` | `multipart/form-data` | ファイルアップロード時 |

### レスポンス形式

すべてのレスポンスはJSON形式で返却されます。エラー時は以下の共通フォーマットに従います。

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "エラーの説明"
  }
}
```

### ページネーション

履歴・ラベル一覧エンドポイントではカーソルベースのページネーションを採用しています。

```json
{
  "items": [],
  "pagination": {
    "nextCursor": "次ページのカーソル値",
    "hasMore": true,
    "totalCount": 100
  }
}
```

---

## エンドポイント一覧

---

### POST /api/diagnose

画像を受け取り、AI推論サービスでランク診断を行い、改善アドバイスを生成します。診断結果はデータベースに保存されます。

#### リクエスト

- **Content-Type**: `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `image` | File | はい | 診断対象の画像ファイル（JPEG/PNG、最大5MB） |

#### リクエスト例

```bash
curl -X POST http://localhost:3000/api/diagnose \
  -F "image=@photo.jpg"
```

#### レスポンス（200 OK）

```json
{
  "diagnosisId": "clxyz1234567890abcdef",
  "rank": 7,
  "advice": "表情の明るさが高評価です。さらに改善するには、照明を正面やや上から当てることで、顔の立体感が増します。",
  "engineType": "v2-resnet50",
  "createdAt": "2026-02-13T10:30:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `diagnosisId` | string | 診断ID（CUID形式） |
| `rank` | number | AI推論によるランク値 |
| `advice` | string | ランクと特徴量に基づく改善アドバイス |
| `engineType` | string | 使用されたAI推論エンジンの種別 |
| `createdAt` | string | 診断日時（ISO 8601形式） |

#### エラーレスポンス

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 400 | `NO_FILE_PROVIDED` | 画像ファイルが送信されていません |
| 400 | `INVALID_FILE_TYPE` | サポートされていないファイル形式です（JPEG/PNGのみ対応） |
| 400 | `FILE_TOO_LARGE` | ファイルサイズが上限（5MB）を超えています |
| 500 | `AI_INFERENCE_FAILED` | AI推論処理中にエラーが発生しました |
| 500 | `DB_SAVE_FAILED` | データベースへの保存に失敗しました |
| 503 | `AI_SERVICE_UNAVAILABLE` | AI推論サービスに接続できません |
| 504 | `AI_TIMEOUT` | AI推論サービスがタイムアウトしました |

#### エラーレスポンス例

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "サポートされていないファイル形式です。JPEG または PNG ファイルをアップロードしてください。"
  }
}
```

---

### GET /api/health

システムのヘルスチェックを行います。データベース接続（`SELECT 1`）とAI推論サービス（`/health`）の状態を確認します。

#### リクエスト

パラメータなし。

#### リクエスト例

```bash
curl http://localhost:3000/api/health
```

#### レスポンス（200 OK）

すべてのサービスが正常な場合：

```json
{
  "status": "healthy",
  "db": true,
  "ai": true
}
```

AI推論サービスがダウンしている場合：

```json
{
  "status": "degraded",
  "db": true,
  "ai": false
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `status` | string | システム全体の状態（`"healthy"` または `"degraded"`） |
| `db` | boolean | データベース接続の状態 |
| `ai` | boolean | AI推論サービスの状態 |

#### ステータスコード

| HTTPステータス | 条件 |
|---------------|------|
| 200 | データベースが正常に稼働している |
| 503 | データベースに接続できない |

---

### GET /api/history

診断履歴の一覧を取得します。カーソルベースのページネーションに対応しています。

#### リクエスト

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `cursor` | string | いいえ | - | ページネーションカーソル（前回レスポンスの `nextCursor` 値） |
| `limit` | number | いいえ | 20 | 取得件数（1〜100） |

#### リクエスト例

```bash
# 最初のページ（20件取得）
curl "http://localhost:3000/api/history"

# カーソル指定で次ページ取得
curl "http://localhost:3000/api/history?cursor=clxyz1234567890abcdef&limit=50"
```

#### レスポンス（200 OK）

```json
{
  "items": [
    {
      "diagnosisId": "clxyz1234567890abcdef",
      "rank": 7,
      "createdAt": "2026-02-13T10:30:00.000Z"
    },
    {
      "diagnosisId": "clxyz0987654321fedcba",
      "rank": 5,
      "createdAt": "2026-02-12T15:20:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "clxyz0987654321fedcba",
    "hasMore": true,
    "totalCount": 150
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `items` | array | 診断履歴の配列 |
| `items[].diagnosisId` | string | 診断ID |
| `items[].rank` | number | ランク値 |
| `items[].createdAt` | string | 診断日時（ISO 8601形式） |
| `pagination.nextCursor` | string \| null | 次ページのカーソル値（最終ページの場合は `null`） |
| `pagination.hasMore` | boolean | 次のページが存在するか |
| `pagination.totalCount` | number | 全件数 |

#### エラーレスポンス

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 400 | `INVALID_LIMIT` | `limit` の値が不正です（1〜100の範囲外） |
| 400 | `INVALID_CURSOR` | `cursor` の値が不正です |
| 500 | `DB_CONNECTION_ERROR` | データベース接続エラー |

---

### GET /api/history/[id]

指定したIDの診断詳細を取得します。

#### リクエスト

| パラメータ | 型 | 位置 | 必須 | 説明 |
|-----------|-----|------|------|------|
| `id` | string | パス | はい | 診断ID（CUID形式） |

#### リクエスト例

```bash
curl http://localhost:3000/api/history/clxyz1234567890abcdef
```

#### レスポンス（200 OK）

```json
{
  "diagnosisId": "clxyz1234567890abcdef",
  "rank": 7,
  "advice": "表情の明るさが高評価です。さらに改善するには、照明を正面やや上から当てることで、顔の立体感が増します。",
  "engineType": "v2-resnet50",
  "createdAt": "2026-02-13T10:30:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `diagnosisId` | string | 診断ID |
| `rank` | number | ランク値 |
| `advice` | string | 改善アドバイス |
| `engineType` | string | AI推論エンジンの種別 |
| `createdAt` | string | 診断日時（ISO 8601形式） |

#### エラーレスポンス

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 404 | `DIAGNOSIS_NOT_FOUND` | 指定された診断IDが見つかりません |
| 500 | `DB_CONNECTION_ERROR` | データベース接続エラー |

---

### GET /api/labels

ラベルデータの一覧を取得します。ランクによるフィルタリングとカーソルベースのページネーションに対応しています。

#### リクエスト

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `rank` | number | いいえ | - | ランク値でフィルタリング（1〜10） |
| `cursor` | string | いいえ | - | ページネーションカーソル |
| `limit` | number | いいえ | 50 | 取得件数（1〜100） |

#### リクエスト例

```bash
# 全ラベル取得
curl "http://localhost:3000/api/labels"

# ランク7のラベルのみ取得
curl "http://localhost:3000/api/labels?rank=7&limit=20"
```

#### レスポンス（200 OK）

```json
{
  "items": [
    {
      "id": "clxyz1234567890abcdef",
      "imageUrl": "https://storage.example.com/images/001.jpg",
      "rank": 7,
      "labeledBy": "annotator-01",
      "createdAt": "2026-02-13T10:30:00.000Z",
      "updatedAt": "2026-02-13T10:30:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "clxyz1234567890abcdef",
    "hasMore": false,
    "totalCount": 1
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `items` | array | ラベルデータの配列 |
| `items[].id` | string | ラベルID |
| `items[].imageUrl` | string | 画像URL |
| `items[].rank` | number | ラベル付けされたランク値（1〜10） |
| `items[].labeledBy` | string \| null | ラベル付けした人の識別子 |
| `items[].createdAt` | string | 作成日時（ISO 8601形式） |
| `items[].updatedAt` | string | 更新日時（ISO 8601形式） |
| `pagination.nextCursor` | string \| null | 次ページのカーソル値 |
| `pagination.hasMore` | boolean | 次のページが存在するか |
| `pagination.totalCount` | number | 全件数（フィルタ適用後） |

---

### POST /api/labels

新しいラベルデータを作成します。

#### リクエスト

- **Content-Type**: `application/json`

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `imageUrl` | string | はい | 画像のURL |
| `rank` | number | はい | ランク値（1〜10） |
| `labeledBy` | string | いいえ | ラベル付けした人の識別子 |

#### リクエスト例

```bash
curl -X POST http://localhost:3000/api/labels \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://storage.example.com/images/001.jpg",
    "rank": 7,
    "labeledBy": "annotator-01"
  }'
```

#### レスポンス（201 Created）

```json
{
  "id": "clxyz1234567890abcdef",
  "imageUrl": "https://storage.example.com/images/001.jpg",
  "rank": 7,
  "labeledBy": "annotator-01",
  "createdAt": "2026-02-13T10:30:00.000Z",
  "updatedAt": "2026-02-13T10:30:00.000Z"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 作成されたラベルのID |
| `imageUrl` | string | 画像URL |
| `rank` | number | ランク値 |
| `labeledBy` | string \| null | ラベル付けした人の識別子 |
| `createdAt` | string | 作成日時（ISO 8601形式） |
| `updatedAt` | string | 更新日時（ISO 8601形式） |

---

### PUT /api/labels/[id]

既存のラベルデータを更新します。指定したフィールドのみ更新されます（部分更新）。

#### リクエスト

- **Content-Type**: `application/json`

| パラメータ | 型 | 位置 | 必須 | 説明 |
|-----------|-----|------|------|------|
| `id` | string | パス | はい | ラベルID |

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `rank` | number | いいえ | 新しいランク値（1〜10） |
| `labeledBy` | string | いいえ | 新しいラベル付与者の識別子 |

#### リクエスト例

```bash
curl -X PUT http://localhost:3000/api/labels/clxyz1234567890abcdef \
  -H "Content-Type: application/json" \
  -d '{
    "rank": 8,
    "labeledBy": "annotator-02"
  }'
```

#### レスポンス（200 OK）

```json
{
  "id": "clxyz1234567890abcdef",
  "imageUrl": "https://storage.example.com/images/001.jpg",
  "rank": 8,
  "labeledBy": "annotator-02",
  "createdAt": "2026-02-13T10:30:00.000Z",
  "updatedAt": "2026-02-13T12:00:00.000Z"
}
```

#### エラーレスポンス

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 404 | `LABEL_NOT_FOUND` | 指定されたラベルIDが見つかりません |

---

### DELETE /api/labels/[id]

指定したラベルデータを削除します。

#### リクエスト

| パラメータ | 型 | 位置 | 必須 | 説明 |
|-----------|-----|------|------|------|
| `id` | string | パス | はい | ラベルID |

#### リクエスト例

```bash
curl -X DELETE http://localhost:3000/api/labels/clxyz1234567890abcdef
```

#### レスポンス（204 No Content）

レスポンスボディなし。

#### エラーレスポンス

| HTTPステータス | エラーコード | 説明 |
|---------------|-------------|------|
| 404 | `LABEL_NOT_FOUND` | 指定されたラベルIDが見つかりません |

---

## AI Service（FastAPI）

AI推論サービスはFastAPIで実装されており、ポート8000で稼働します。メインAPIから内部的に呼び出されます。

### ベースURL

```
http://localhost:8000
```

---

### POST /predict

画像ファイルを受け取り、AI推論によるランク予測を行います。

#### リクエスト

- **Content-Type**: `multipart/form-data`

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `file` | UploadFile | はい | 推論対象の画像ファイル |

#### リクエスト例

```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@photo.jpg"
```

#### レスポンス（200 OK）

```json
{
  "rank": 7,
  "confidence": 0.85,
  "features": {
    "symmetry": 0.82,
    "clarity": 0.91,
    "expression": 0.78,
    "lighting": 0.88
  },
  "engine": "v2-resnet50"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `rank` | number | 推論されたランク値 |
| `confidence` | number | 推論の信頼度（0.0〜1.0） |
| `features` | object | 画像から抽出された特徴量 |
| `engine` | string | 使用された推論エンジン名 |

---

### GET /health

AI推論サービスのヘルスチェックを行います。

#### リクエスト

パラメータなし。

#### リクエスト例

```bash
curl http://localhost:8000/health
```

#### レスポンス（200 OK）

```json
{
  "status": "ok",
  "engine": "v2-resnet50",
  "version": "1.0.0"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `status` | string | サービスの状態 |
| `engine` | string | 現在ロードされている推論エンジン名 |
| `version` | string | サービスのバージョン |

---

## エラーコード一覧

全エンドポイント共通で使用されるエラーコードの一覧です。

### クライアントエラー（4xx）

| エラーコード | HTTPステータス | 説明 | 対処方法 |
|-------------|---------------|------|---------|
| `NO_FILE_PROVIDED` | 400 | 画像ファイルが送信されていません | `image` フィールドに画像ファイルを添付してください |
| `INVALID_FILE_TYPE` | 400 | サポートされていないファイル形式です | JPEG または PNG 形式の画像を使用してください |
| `FILE_TOO_LARGE` | 400 | ファイルサイズが上限を超えています | 5MB以下のファイルを使用してください |
| `INVALID_LIMIT` | 400 | `limit` パラメータが不正です | 1〜100の整数を指定してください |
| `INVALID_CURSOR` | 400 | `cursor` パラメータが不正です | 前回レスポンスの `nextCursor` 値を使用してください |
| `DIAGNOSIS_NOT_FOUND` | 404 | 指定された診断IDが存在しません | 正しい診断IDを指定してください |
| `LABEL_NOT_FOUND` | 404 | 指定されたラベルIDが存在しません | 正しいラベルIDを指定してください |

### サーバーエラー（5xx）

| エラーコード | HTTPステータス | 説明 | 対処方法 |
|-------------|---------------|------|---------|
| `AI_INFERENCE_FAILED` | 500 | AI推論処理中にエラーが発生しました | しばらく待ってから再試行してください |
| `DB_SAVE_FAILED` | 500 | データベースへの保存に失敗しました | システム管理者に連絡してください |
| `DB_CONNECTION_ERROR` | 500 | データベース接続エラーが発生しました | システム管理者に連絡してください |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI推論サービスに接続できません | AI推論サービスの稼働状態を確認してください |
| `AI_TIMEOUT` | 504 | AI推論サービスがタイムアウトしました | しばらく待ってから再試行してください |

---

*RankMe API Reference v1.0.0*

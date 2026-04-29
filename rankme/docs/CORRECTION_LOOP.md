# 判定結果フィードバックと再学習ループ

ユーザーが診断結果を「想定外」と判断したとき、本来あるべきランクを教えてもらい、その情報を次回以降の判定精度向上に活用するための仕組み。

## 全体フロー

```
ユーザー
  │ 1. 画像アップロード
  ▼
Next.js (Web)
  │ 2. AI推論依頼 (HF Spaces)
  ▼
HF Spaces AI (similarity_v1)
  │ 3. ランク + features.npz類似度
  ▼
Diagnosis レコード保存（rank, features 等）
  │ 4. 結果表示
  ▼
ユーザー
  │ 5. フィードバック
  │    - 「適切でした」 → そのまま
  │    - 「修正したい」 → 本来のランクXを選択
  ▼
POST /api/diagnose/{id}/correction
  │ correctedRank, correctionNote, correctedAt を保存
  ▼
（オフライン）
  │ 6. /api/admin/corrections?format=csv で集約取得
  ▼
HF Space オーナー（江上塾運営）
  │ 7. 補正データを labels.csv に追加
  │ 8. precompute.py で features.npz 再生成
  │ 9. HF Space を更新
  ▼
次回以降の判定精度が向上
```

## DB スキーマ

`Diagnosis` テーブルに3カラム追加：

| カラム | 型 | 説明 |
|---|---|---|
| `corrected_rank` | smallint? | ユーザーが指定した本来のランク（1-10）|
| `correction_note` | text? | 自由記述コメント（最大500文字）|
| `corrected_at` | timestamp? | フィードバック実施日時 |

`null` のままなら未フィードバック。値が入っていれば「想定外だった」と修正された診断。

## API

### `POST /api/diagnose/{id}/correction`

ユーザーフィードバックを記録。

**Request**:
```json
{
  "correctedRank": 7,
  "note": "照明の影響で実際より暗く写った（任意）"
}
```

**Response**:
```json
{
  "diagnosisId": "clx...",
  "originalRank": 5,
  "correctedRank": 7,
  "correctedAt": "2026-04-29T10:00:00.000Z",
  "message": "ご協力ありがとうございました。次回以降の判定精度向上に使われます。"
}
```

### `GET /api/diagnose/{id}/correction`

特定診断の修正状況を取得。

### `GET /api/admin/corrections[?format=csv]`

すべてのフィードバック済み診断を集約取得（再学習用）。

- 認可：`x-admin-token` ヘッダーが env `ADMIN_TOKEN` と一致する場合のみ
- `format=csv` 指定で CSV ダウンロード

例：
```bash
curl -H "x-admin-token: ${ADMIN_TOKEN}" \
  "https://rankme-tau.vercel.app/api/admin/corrections?format=csv" \
  > corrections.csv
```

## オフライン再学習プロセス（運営オペレーション）

### 月次サイクル

1. **収集**：上記CSVをダウンロード
2. **レビュー**：明らかな誤入力（例：写真と無関係な評価）を除外
3. **マージ**：`training-data/labels.csv` に追記（`photo_id` を新採番、または既存IDの `rank` を上書き）
4. **再計算**：`ai/precompute.py` を実行 → 新しい `models/features.npz` を生成
5. **更新**：HF Space の `models/` ディレクトリを差し替えてpush
6. **検証**：本番で数件の診断を実施し、`mean_absolute_delta` が改善傾向か確認

### 検証指標

`/api/admin/corrections` レスポンスの `summary` を月次で記録：

| 指標 | 改善方向 |
|---|---|
| `totalCorrections` | 任意（増えるほど学習材料が多い） |
| `meanAbsoluteDelta` | 減少（モデル予測 vs 人間判定の差が縮小） |

`meanAbsoluteDelta` が前月比で減ればモデル改善が効いている指標。

## 倫理・注意事項

- フィードバックは匿名（個人特定情報を保存しない）
- 修正コメントは最大500文字に制限し、ユーザー入力のサニタイズを実施
- `ADMIN_TOKEN` は本番環境では必ず設定し、運営のみが知る値を使用

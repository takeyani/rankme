# Rankme「綺麗」判定ロジック説明書 (2026-06-18 時点)

ユーザーがアップロードした顔画像から「ランク (1〜10)」を返すまでの判定ロジックを、実コード(`src/app/api/diagnose/route.ts` / `ai/engines/similarity_v1.py` / `src/lib/agi/bias.ts` / `src/app/api/diagnose/[id]/correction/route.ts`)を読んで書き起こしたもの。

---

## 0. 全体像 (1枚絵)

```
[ユーザー画像]
   ↓ POST /api/diagnose                                       (Next.js / Vercel)
   ↓ サイズ/タイプ検証 (≦5MB, JPEG/PNG)
   ↓
   ↓ POST {AI_SERVICE_URL}/predict                            (Python FastAPI / HF Spaces)
   ├─ MTCNN で顔検出 (検出失敗→HTTP 400)
   ├─ FaceNet (InceptionResnetV1, VGGFace2 pretrained) で 512次元 embedding 抽出
   ├─ L2正規化
   ├─ 学習データ embeddings (features.npz, ランク①〜⑩のフォルダ別) と cosine 類似度を取る
   ├─ 上位 K=25 (RANKME_K_NEIGHBORS) 近傍を抽出
   ├─ Softmax(温度 TEMPERATURE=0.07) で重み付け
   ├─ ランクバケット(①〜⑩)に重みを集約 → argmax で離散ランク決定
   ├─ Tie-break: 連続平均に近い & 高ランク優先
   ├─ confidence = sim_score×0.5 + agreement×0.25 + vote_concentration×0.25
   ├─ improvement_areas をルールベースで付与
   └─ 生 embedding を base64 化して features.embedding_b64 に同梱
   ↓ (rank, confidence, features)
   ↓
   ↓ Next.js 側 (route.ts ステップ 5-7)
   ├─ computeBiasMap(ACTIVE_SCOUT_ID) … 過去の補正フィードバックから bias を学習
   ├─ applyBias(aiRawRank, biasMap)  … 安全弁付きで補正・[1,10] にクランプ
   ├─ generateAdvice(finalRank, advice_context) … アドバイス生成
   └─ Diagnosis テーブルに保存 (embedding を別カラムに分離して格納)
   ↓
[フロント]  { rank, aiRawRank, biasApplied, biasConfidence, advice, diagnosisId }
```

---

## 1. アーキテクチャ

| 層 | 実体 | ホスト |
|---|---|---|
| Web/API | Next.js (App Router) | Vercel (`rankme-tau.vercel.app`) |
| AI 推論 | FastAPI + PyTorch + facenet-pytorch | Hugging Face Spaces (`takeyani-rankme-ai.hf.space`) |
| DB | PostgreSQL (Prisma) | (環境変数 `DATABASE_URL`) |
| 通信 | HTTPS multipart/form-data | `POST /predict`, `GET /health` |
| セキュリティ | SSRF対策で AI ホストの allowlist | `ALLOWED_AI_HOSTS` in `diagnose/route.ts` |

---

## 2. AI Service の「ランク決定」ロジック (`ai/engines/similarity_v1.py`)

### 2.1 前処理 / 特徴抽出
- **顔検出**: MTCNN (`image_size=160`, `min_face_size=40`, `thresholds=[0.6,0.7,0.7]`, `keep_all=False`)
  - 検出失敗 → `features.error="face_not_detected"` → API が HTTP 400 を返す
- **embedding**: InceptionResnetV1 (`pretrained="vggface2"`) で 512次元ベクトル → L2正規化

### 2.2 類似度 → 重み
- 学習データ全件との **コサイン類似度** = `features @ feat` (L2正規化済みなので内積=cos)
- 上位 K=25 (`RANKME_K_NEIGHBORS`, env で変更可) を取得
- 上位の類似度に Softmax (温度 `TEMPERATURE=0.07`) を適用
  - `shifted = (top_sims - max) / 0.07` → `exp` → 正規化
  - 温度が低いほど「最も似ている近傍」に重みが集中

### 2.3 ランクの離散化 (アルゴリズムの核)
- 学習データは「ランク ① 〜 ⑩」の **10 個のフォルダ** に整理されている (各人を所属ランクに分類)。
- 上位 K 近傍について、各近傍の所属ランク (整数) に対し、Softmax 重みを **バケット ①〜⑩ に加算** していく:

  ```text
  for each neighbor (weight w, rank r):
      bucket_weights[r] += w
  rank = argmax(bucket_weights)
  ```

- **Tie-break**: ほぼ同点バケットが複数あったら、連続平均ランク (`predicted_rank = Σ w·r`) に近い側を優先。完全等距離なら **高ランク優先** (これにより稀少なランク ⑨/⑩ が機械的に切り捨てられない)。

> なぜ argmax 投票か: 単純な「重み付き平均→round」だと隣接バケットに引っ張られて中央(④〜⑥)に固まる症状が出る。バケット投票なら **必ず実在する近傍ランクのうち最有力なもの** が選ばれる。

### 2.4 confidence (0〜1)
3要素のブレンド:
| 要素 | 意味 | 重み |
|---|---|---|
| `sim_score = (max_sim - 0.3) / 0.6` | 最近傍類似度を 0.3〜0.9 のレンジで 0-1 化 | 0.5 |
| `agreement = 1 - rank_std/3.0` | 上位 K の所属ランクのばらつきが小さいほど高い | 0.25 |
| `vote_concentration = bucket_weights[rank]` | 勝ったバケットが票全体に占める割合 | 0.25 |

### 2.5 副次情報 (`features`)
- `predicted_wage`: 想定時給 (近傍時給の重み付き平均、`wages` も `features.npz` に同梱)
- `top_similarity`: 最大類似度
- `rank_raw`: 連続平均ランク (デバッグ・分析用)
- `vote_distribution`: バケット重み分布
- `neighbors`: 上位 5 人 (person_id重複除去後)
- `improvement_areas`: ランク帯ごとのアドバイス領域 (ルールベース)
  - rank ≤3: skin_quality / hair_balance / overall_grooming / eye_impression / face_symmetry
  - rank ≤5: eyebrow_shape / skin_tone_uniformity / hair_balance / lip_shape
  - rank ≤7: eyebrow_shape / facial_proportion / jawline
  - rank ≤9: skin_tone_uniformity / nose_shape
  - rank 10: 改善提案なし
- `embedding_b64` / `embedding_model` / `embedding_dim`: 生 embedding (将来の fine-tune 用にDBへ保存)

### 2.6 fallback
- 学習データ `features.npz` が未配置の場合は `rank=5, confidence=0.1, mode=fallback` を返す。

---

## 3. Next.js 側の補正レイヤー (`src/app/api/diagnose/route.ts`)

AI が返した `aiRawRank` をそのまま使うのではなく、過去の人間フィードバックから学習した **バイアス補正** を当てて最終ランクを出す。

### 3.1 バイアスマップ計算 (`src/lib/agi/bias.ts` の `computeBiasMap(scoutId?)`)
1. `CorrectionSample` テーブルから (aiRawRank, correctedRank) のペアを取得 (scoutId でフィルタ可)
2. 各 AI 生ランクごとに `delta = corrected - aiRaw` の配列を作る
3. ランクごとに **3 つの安全弁** を適用:
   - **MIN_SAMPLES_PER_RANK = 20** : 20件未満 → `bias=0, suppressed="low_samples"`
   - **MAX_NOISE_STD = 2.0** : delta の標準偏差が 2.0 超 → `bias=0, suppressed="noisy"`
   - **MAX_BIAS = 1.0** : `mean` を ±1.0 で clamp
4. `confidence = min(1, n/100) × max(0, 1 - std/2.0)` を算出

> 旧版 (`MIN_SAMPLES=1, MAX_BIAS=1.5`) は実測で Spearman をベースラインより悪化させていた。少サンプル平均/ノイジーなバケットの補正がノイズ増幅器になっていたため、現バージョンは保守的に「自信のないバケットは触らない」設計。詳細は `rankme-accuracy-investigation.md`。

### 3.2 バイアス適用 (`applyBias`)
```ts
const raw = aiRank + entry.bias
const clamped = Math.max(1, Math.min(10, Math.round(raw)))
return { adjusted: clamped, bias: entry.bias, confidence: entry.confidence }
```
- バケットの bias が 0 なら何も補正されない (= AI生ランクがそのまま)。
- 必ず整数の [1,10] に収まる。

### 3.3 スカウト視点 (重要)
- 本アプリの「正解」は **特定スカウトの主観判定** を Ground Truth として扱う設計。
- 環境変数 `ACTIVE_SCOUT_ID` が指定されていれば、その scout のサンプルだけで bias を学習する (他人の主観を混ぜると軸がブレる)。
- 未指定なら全 CorrectionSample から集計 (旧データ互換)。

---

## 4. 補正 (Correction) ロジック詳細

エンドポイント: `POST /api/diagnose/[id]/correction`
実装: `src/app/api/diagnose/[id]/correction/route.ts`

### 4.1 受け取るペイロード (zod スキーマ)
```ts
{
  correctedRank: 1..10,           // 必須・整数
  confidenceScore?: 1..5,         // 1=うろ覚え / 5=確信。省略時は null
  scoutId?: string(1..64),        // スカウト識別 (省略時=汎用プール null)
  note?: string(≤500)             // 任意メモ。trim 後空ならnull
}
```
スキーマ違反は `INVALID_BODY` で 400 を返す。

### 4.2 評価者の匿名識別 (`correctorHash`)
- Cookie `rmc-uid` を参照 → あれば SHA256 化して `correctorHash` に。
- なければ `${Date.now()}-${Math.random()}-${userAgent}` を SHA256 化 → 先頭32文字を `newId` → さらに SHA256 → DB 格納。`Set-Cookie: rmc-uid=newId; HttpOnly; SameSite=Lax; Max-Age=1年` を返す。
- **DB には生 ID を入れない**。同一評価者の弱い識別だけが目的で、個情リスクを最小化。

### 4.3 永続化 + 集約 (1トランザクション)
```text
BEGIN TX
  1. CorrectionSample を1件 INSERT
       (diagnosisId, correctedRank, confidenceScore, correctorHash, scoutId, note)
  2. 同じ (diagnosisId, scoutId) のサンプル全件を createdAt ASC で読む
  3. correctedRank をソート → 中央値で「集約値 (rolledUp)」を決定
       sorted = samples.sort((a,b) => a - b)
       mid = floor((sorted.length - 1) / 2)
       rolledUp = sorted[mid]    // 偶数件 → 下側中央値 (整数保持のため)
  4. Diagnosis を UPDATE
       correctedRank = rolledUp
       correctionNote = note (任意)
       correctedAt = now()
COMMIT
```
**ポイント**:
- 「最新値で上書き」ではなく **同一 scoutId の中央値で集約** → 1件のノイズで結論が揺れない。
- 中央値の `mid` は「下側中央値」になる (偶数件で半端な小数値を避けるため、整数ランクを保証)。
- 異なる scoutId 同士は混ぜない (集約も bias 学習も scoutId 単位で完結)。

### 4.4 レスポンス
```jsonc
{
  "diagnosisId": "...",
  "originalRank": 6,            // Diagnosis.rank (AI出力をbias適用した最終ランク)
  "correctedRank": 7,           // 集約後の中央値
  "sampleCount": 3,             // 集約に使われた件数
  "correctedAt": "2026-06-18T...",
  "message": "3 件の評価を集約しました。"   // 初回は別文言
}
```
- `Set-Cookie` は新規 cookie 発行時のみ付与。

### 4.5 GET (同URL)
- 現在の集約値 + 個別 CorrectionSample 履歴を返す。UI でラベルノイズを可視化するためのもの。
- 返すサンプル: `id / correctedRank / confidenceScore / note / createdAt`。`correctorHash` や `scoutId` は外に出さない。

### 4.6 ループ全体 (次の予測に効くまで)
```text
[人間が修正] → /api/diagnose/[id]/correction POST
   → CorrectionSample 1件追加 + Diagnosis.correctedRank 更新 (中央値)

[新しい予測] → /api/diagnose POST
   → AI が aiRawRank を返す
   → computeBiasMap(activeScoutId) が CorrectionSample から (aiRawRank, correctedRank) を集計
   → 該当バケット (n≧20, std≦2.0) のときだけ bias を当てる
   → finalRank = clip([1,10], round(aiRawRank + bias))
```
- 1件の修正だけでは bias は当たらない (n<20 で suppressed)。
- 20件以上たまった「ノイズが少ない」バケットのみ補正される。
- 補正は ±1.0 まで。AI の意見を大きくはひっくり返さない設計。

### 4.7 fine-tune 用エクスポート
- `GET /api/admin/corrections?format=jsonl&include=embedding&scout=<id>` で、補正サンプル + 元 Diagnosis の embedding を JSONL で取り出す。
- これにより、(embedding → corrected rank) の (X, y) ペアを将来の学習用に使える。bias.ts はあくまで「軽い online 補正」、本命は fine-tune 素材の蓄積。

---

## 5. 追加で行っている「判定の外の」処理

ランク数値を返すこと以外に、実装が裏で走らせている判断・防御・補完を網羅。

### 5.1 入力のガード
| 項目 | 場所 | 値 | 目的 |
|---|---|---|---|
| ファイル取得失敗 | `route.ts` Step1 | `NO_FILE_PROVIDED` 400 | フォーム不正 |
| MIME 限定 | `route.ts` Step2 | `image/jpeg`, `image/png` のみ | 非画像/EXEを拒否 |
| サイズ上限 (Web) | `route.ts` Step3 | 5MB | Vercel/HFのリソース保護 |
| サイズ上限 (AI) | `main.py` | 5MB | AI 側でも独立にガード |
| 画素上限 | `main.py` | 4096×4096 | decompression bomb 対策 |
| Pillow 全体上限 | `main.py` | 32,000,000 px | 同上 (Pillow `MAX_IMAGE_PIXELS`) |

### 5.2 顔検出失敗のハンドリング
- MTCNN で顔が見つからないと engine は `rank=0, features.error="face_not_detected"` を返す。
- `main.py` がこれを 400 に変換し「顔が検出できませんでした。人の顔が写った画像をアップロードしてください」を返す。
- Web 側は `INVALID_IMAGE` として上流のメッセージをそのまま表示。

### 5.3 SSRF 防止 (AI Service URL の検証)
- `getAiServiceUrl()` が URL を `new URL()` で parse → プロトコル http/https チェック → **hostname を `ALLOWED_AI_HOSTS` の集合と照合**。
- 許可: `localhost`, `127.0.0.1`, `ai`, `takeyani-rankme-ai.hf.space`。
- これにより、`AI_SERVICE_URL` が事故/攻撃で別ホストに変えられても外部に画像が漏れない。

### 5.4 タイムアウト (2 系統)
- `/api/diagnose`: `AbortController` で **30秒**。超過時 `AI_TIMEOUT` 504。
- `/api/health`: `AbortController` で **5秒**。超過時 `aiHealthy=false`。
  - 注: HF Space の cold start は10〜30秒かかるため、現状の 5秒設定は health の degraded 誤検知を生む。詳細は `ai-degraded-incident_2026-06-18.md`。

### 5.5 AI 応答のエラー振り分け
| 上流ステータス | クライアント返り値 |
|---|---|
| 400 + detail あり | `INVALID_IMAGE` 400 (上流文言をそのまま) |
| 503 | `AI_SERVICE_UNAVAILABLE` 503 |
| その他失敗 | `AI_INFERENCE_FAILED` 500 (上流の生詳細はログのみで外に出さない) |
| Abort (timeout) | `AI_TIMEOUT` 504 |
| 接続不可 | `AI_SERVICE_UNAVAILABLE` 503 |

### 5.6 embedding の永続化 (extractEmbeddingBytes)
- `features.embedding_b64` を Buffer.from(b64, 'base64') でデコード。
- **長さ検証**: 4バイト未満 / 64KB 超は捨てる (毒入りレスポンスでカラムを壊さない安全弁)。
- 成功すれば `Diagnosis.embedding` (Bytes) と `Diagnosis.embeddingModel` に格納。
- 同時に、JSON 列の `features` からは `embedding_b64`, `embedding_model`, `embedding_dim` を **除外** (同じものを2回保存しない)。
- 失敗しても診断保存自体は続行 (旧エンジン互換)。

### 5.7 アドバイス生成 (`generateAdvice` / `formatAdviceForResponse`)
- 入力: **最終ランク (bias 適用後)** と `advice_context.improvement_areas`。
- ロジック: rank と improvement_areas に応じてアドバイス項目を組み立て (実装は `src/lib/advice-generator.ts`)。
- 出力は JSON のリストでフロントに渡る (`Diagnosis.advice` にも JSON で保存)。

### 5.8 confidence=0 の bias 抑止
- `applyBias` は `biasMap[aiRank]` を見るが、ランクが存在しない/抑止された (suppressed) バケットは `bias=0, confidence=0` で返す → 結果として AI 生ランクがそのまま使われる。
- これにより「信用できない bucket は触らない」が常に保証される。

### 5.9 タイトブレイク (ランク確定時)
- バケット投票で最大票が複数あった場合の決め方:
  1. 連続平均ランク (`predicted_rank`) に最も近いバケットを選ぶ。
  2. 距離が完全に同じ場合、**高い方のランク** を選ぶ (rare class を救う)。

### 5.10 Engine Registry (差し替え可能性)
- `ai/main.py` は `EngineRegistry` 経由でアクティブエンジンを取り出す。
- 環境変数 `RANKME_ENGINE` (既定 `similarity_v1`) を変えるだけで別実装に切替可能。
- 引数・戻り値は `BaseEngine.predict(img) -> { rank, confidence, features }` に統一。

### 5.11 CORS の挙動
- `ai/main.py` は `ALLOWED_ORIGINS` env が "*" のまま (既定) なら **permissive モード + credentials=false** で警告ログを出す。
- 本番は `ALLOWED_ORIGINS` に `https://rankme-tau.vercel.app` 等を明示する想定。

### 5.12 DB 保存失敗
- `Diagnosis` 作成が失敗した場合 `DB_SAVE_FAILED` 500 で返す。AI 推論結果は破棄されるため、再アップロードで再試行になる。

### 5.13 cookie 識別の寿命
- correction cookie `rmc-uid` の Max-Age は **1年**。
- 同一ユーザーから1年以内の複数 correction を同一 hash で集計できる (median 集約が機能する)。

### 5.14 ログ流出防止
- 上流 AI のエラー詳細は `console.error` のみに出し、**クライアントには上流の生メッセージを渡さない** (400 で detail がある場合のみ例外的に渡す)。

---

## 6. 主要パラメータ一覧

| パラメータ | 既定値 | 由来 | 効果 |
|---|---|---|---|
| `K_NEIGHBORS` | 25 | `RANKME_K_NEIGHBORS` env | 投票に使う近傍数 |
| `TEMPERATURE` | 0.07 | `RANKME_TEMPERATURE` env | Softmax 温度。低いほど最近傍に重み集中 |
| `MAX_FILE_SIZE` (Web/AI) | 5MB | コード定数 | アップロード上限 |
| `MAX_IMAGE_DIMENSION` | 4096 | コード定数 | 画像最大ピクセル数 |
| `MAX_IMAGE_PIXELS` (Pillow) | 32,000,000 | コード定数 | decompression bomb 対策 |
| `AI_TIMEOUT_MS` | 30,000 | コード定数 | AI 呼び出しタイムアウト |
| Health チェック timeout | 5,000 | `health/route.ts` | HF Space cold start で詰まる原因 |
| `MIN_SAMPLES_PER_RANK` | 20 | `bias.ts` | これ未満の bias は無効化 |
| `MAX_BIAS` | 1.0 | `bias.ts` | バイアス絶対値の上限 |
| `MAX_NOISE_STD` | 2.0 | `bias.ts` | これ超のノイズは bias を捨てる |
| 集約方式 | 中央値 (下側) | `correction/route.ts` | ノイズ耐性のため |
| Cookie Max-Age | 1年 | `correction/route.ts` | 同一評価者の継続識別 |
| `ACTIVE_SCOUT_ID` | (任意) | env | 学習に使うスカウトの絞り込み |
| `ALLOWED_ORIGINS` (AI) | "*" | env | CORS allowlist |
| `ALLOWED_AI_HOSTS` | localhost / 127.0.0.1 / ai / takeyani-rankme-ai.hf.space | コード定数 | SSRF 対策 |
| `engine` | `similarity_v1` | `RANKME_ENGINE` env | 推論エンジン選択 |

---

## 7. データモデル抜粋

### Diagnosis
- `id`
- `rank` … 最終ランク (bias 適用後、[1,10] 整数)
- `aiRawRank` … AI 生ランク (補正前)
- `biasApplied` / `biasConfidence` … 適用された bias 量と信頼度
- `advice` (JSON)
- `engineType` (例: `similarity_v1`)
- `features` (JSON, embedding_b64 系は除外して保存)
- `embedding` (Bytes), `embeddingModel` (String) … fine-tune 用素材
- `correctedRank` / `correctionNote` / `correctedAt` … 補正集約値
- `processingTimeMs`
- 1:N → `correctionSamples`

### CorrectionSample
- `id` / `diagnosisId` / `correctedRank` / `confidenceScore` (1-5) / `correctorHash` (SHA256) / `scoutId` (nullable) / `note` / `createdAt`

---

## 8. なぜこの設計か (前提)

- **Ground Truth は1人(または特定スカウト)の主観**。複数評価者を平均すると軸がブレるため、スカウト軸で完結する集約・学習に統一している。
- **Embedding と rank の間に汎用的線形相関は実測でほぼ無い**ことが確認済 (Spearman ≈ 0)。よって表面的な online bias で短期精度を上げるより、**生 embedding を永続化して将来の fine-tune 用素材として蓄積する** 方を主軸にしている。
- bias は「明らかな系統誤差だけを直す」用途に絞り、ノイズが少しでも大きいバケットは触らないことで「補正がかえって精度を下げる」現象を防いでいる。

---

## 9. 主な関連ファイル

- `src/app/api/diagnose/route.ts` — 全体オーケストレーション (検証→AI転送→bias→保存)
- `src/app/api/diagnose/[id]/correction/route.ts` — フィードバック収集と中央値集約
- `src/app/api/admin/corrections/route.ts` — JSONL エクスポート (fine-tune 用)
- `src/app/api/health/route.ts` — DB + AI 到達のヘルスチェック
- `src/lib/agi/bias.ts` — bias 学習と適用
- `src/lib/advice-generator.ts` — 改善アドバイス生成 (rank と improvement_areas から)
- `ai/main.py` — FastAPI のエントリ。/predict と /health
- `ai/engine_registry.py` — エンジンの抽象化
- `ai/engines/similarity_v1.py` — 推論ロジック本体 (このドキュメント 2章の内容)
- `ai/precompute.py` — 学習データから `features.npz` を作成 (ランクはフォルダ ①-⑩ から取る)
- `prisma/migrations/20260529120000_add_correction_samples` / `20260529130000_add_scout_id` — 補正ループ再設計のスキーマ
- `docs/CORRECTION_LOOP.md` / `docs/rankme-accuracy-investigation.md` — 設計根拠と精度検証
- `docs/ai-degraded-incident_2026-06-18.md` — health degraded の原因 (HF Space スリープ + 5秒タイムアウト)
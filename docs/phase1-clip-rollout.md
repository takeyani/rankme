# Phase 1 ロールアウト手順: CLIP ViT-L/14 エンジンへの切替

`docs/research-latest-methods_2026-06-18.md` の Phase 1 を実装に落とした手順書。
本番に切り替えるまでの順序、所要時間、ロールバック手段をまとめる。

---

## 0. このフェーズで何が増えたか (コード)

| ファイル | 役割 |
|---|---|
| `ai/engines/clip_v1.py` | 新エンジン本体。CLIP ViT-L/14 + 顔検出 + k-NN投票 + 任意の MLP head ブレンド |
| `ai/precompute_clip.py` | `features_clip.npz` 生成 (CLIP 埋め込み版) |
| `ai/scripts/train_clip_head.py` | SCUT-FBP5500 + 補正JSONL で MLP head 学習 (Colab前提) |
| `ai/tests/test_clip_engine.py` | rank決定ロジック parity と engine_registry 切替テスト |
| `ai/engine_registry.py` | `RANKME_ENGINE=clip_v1` で切替対応 (既定は similarity_v1 のまま) |
| `ai/requirements.txt` | `transformers==4.44.2` 追加 (lazy import なので未使用時は影響なし) |
| `ai/Dockerfile` | `--build-arg INCLUDE_CLIP=1` で CLIP 重みを焼き込み (省略時は従来通り) |

**既存ユーザー影響**: ゼロ。`RANKME_ENGINE` 未指定なら similarity_v1 が選ばれ、コード経路は一切変わらない。

---

## 1. 環境変数 (HF Space に設定するもの)

```
RANKME_ENGINE=clip_v1                                # ← これだけで切替
RANKME_CLIP_MODEL=openai/clip-vit-large-patch14      # (デフォルト同じなので省略可)
RANKME_K_NEIGHBORS=25                                # similarity_v1 と同じ
RANKME_TEMPERATURE=0.07                              # similarity_v1 と同じ
RANKME_HEAD_BLEND=0.0                                # MLP head を使うときだけ 0.3 〜 0.5 推奨
CLIP_FEATURES_PATH=/models/features_clip.npz         # 既定値
CLIP_HEAD_PATH=/models/clip_head.pt                  # MLP head 使用時のみ必要
```

`RANKME_HEAD_BLEND=0.0` のままなら head ファイルが無くてもエラーにならない。
head を入れたあとに段階的に `0.3 → 0.5` に上げて安全に評価可能。

---

## 2. ロールアウト手順 (推奨順)

### Step 1 — ローカル動作確認 (30分)

```powershell
cd C:\CCAGI\rankme\ccagi\ai
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 軽量ユニットテスト (stub だけで完結、CLIP重みのDL不要)
python tests\test_clip_engine.py -v
python tests\test_rank_logic.py -v
```

> tests は CLIP/Torch を stub しているので **GPU不要・モデルDL不要** で動く。

### Step 2 — Colab で SCUT-FBP5500 から head と features_clip.npz を作る (1-2時間)

1. SCUT-FBP5500 v2 をダウンロード ([公式GitHub](https://github.com/HCIILAB/SCUT-FBP5500-Database-Release))
   - 研究目的は無料。**商用利用前は著者にメール一本** で許諾確認推奨
2. Colab に images + ratings ファイルをアップロード
3. ノートブックで以下を実行:

```python
!pip install transformers==4.44.2 facenet-pytorch==2.6.0 torch torchvision numpy pillow
!git clone <あなたのrankmeリポジトリ> rankme
%cd rankme/ai

# (A) head 学習 — 約30分 (T4 GPU)
!python scripts/train_clip_head.py \
  --scut-images /content/SCUT-FBP5500_v2/Images \
  --scut-ratings /content/SCUT-FBP5500_v2/train_test_files/All_labels.txt \
  --out /content/clip_head.pt

# (B) 自社 training-data から features_clip.npz を再生成 — 約45分 (T4 GPU)
!TRAINING_DIR=/content/training-data MODEL_DIR=/content/models python precompute_clip.py
```

成果物:
- `/content/clip_head.pt` (約 2MB)
- `/content/models/features_clip.npz` (数十MB)

両方を **HF Space のリポジトリの `models/` 配下にコミット**。

### Step 3 — HF Space を clip_v1 でビルド・デプロイ (30分)

HF Space のリポジトリで:

```bash
# Dockerfile 利用時
docker build --build-arg INCLUDE_CLIP=1 -t rankme-ai-clip .
```

HF Space の Variables/Secrets に環境変数を設定:
- `RANKME_ENGINE=clip_v1`
- (任意) `RANKME_HEAD_BLEND=0.3` ← head 学習が完了し品質確認できたら有効化

Push → 自動ビルド → 起動を待つ。

### Step 4 — Vercel 側の確認

Vercel 側のコード変更は **不要**。`/api/health` と `/api/diagnose` は AI Service の URL を変えずに使える。

ヘルスチェック:
```bash
curl https://rankme-tau.vercel.app/api/health
# 期待: {"status":"healthy","db":true,"ai":true}
```

`/api/diagnose` を実画像で叩いて、レスポンスに新フィールドが含まれることを確認:
```jsonc
{
  "rank": 7,
  "aiRawRank": 7,
  "engineType": "clip_v1",           // ← ここが変わったら成功
  "biasApplied": 0,                  // 補正は同じスカウト軸で蓄積継続
  ...
}
```

### Step 5 — 段階的に head ブレンドを上げる

1. `RANKME_HEAD_BLEND=0.0` で1週間運用 → k-NN のみで精度確認
2. 補正サンプルの k-NN vs corrected の相関を `/learn` ページで確認
3. `0.3 → 0.5` と段階的に上げ、`/api/learning-summary` の指標が改善するか A/B 監視

---

## 3. ロールバック (5分)

問題が出たら HF Space の env を即時切替:

```
RANKME_ENGINE=similarity_v1
```

→ 次のコールドスタートで legacy エンジンに戻る。

それでも安定しない場合:
1. `RANKME_ENGINE=clip_v1` のまま `RANKME_HEAD_BLEND=0.0` に下げる (head のみ無効化)
2. `CLIP_FEATURES_PATH` を旧バックアップに差し替え
3. HF Space を一つ前のコミットに rollback

データ側 (DB/補正) は新旧エンジン共通で互換、`engineType` カラムでどちらの予測かは区別可能。

---

## 4. 期待される改善とリスク

### 期待
- FaceNet embedding と rank の Spearman ≈ 0 が課題だった (`rankme-accuracy-investigation.md`)。CLIP は LAION の事実上の標準で、汎用美的相関が0.7〜の実績。 **同じデータでも Spearman を 0.4〜0.6 程度に押し上げる余地**。
- 補正サンプルの効きも改善 (bias 補正の母集団のばらつきが小さくなり、MIN_SAMPLES_PER_RANK=20 のゲートを通る確率↑)。

### リスク
| リスク | 影響 | 対策 |
|---|---|---|
| CLIP は FaceNet の約18倍重い (~430Mパラ) | HF CPU で推論 3-6秒、cold start +25秒 | ai-degraded-incident_2026-06-18.md の対策 (Cron ウォームアップ or HF CPU upgrade) と同時に進める |
| `transformers` 依存が追加 | Docker サイズ +1.5GB | `INCLUDE_CLIP=1` ビルド時のみ。CPU プランの 16GB 制限の範囲内 |
| SCUT-FBP5500 ライセンス | 商用利用は要確認 | head 学習を在野データのみに切り替え可能 (補正JSONLだけで学習する `--corrections` モードあり) |
| Spearman は実測しないと不明 | 期待外れの可能性 | Step 5 の A/B 監視で判断、ダメなら `HEAD_BLEND=0.0` で k-NN のみに戻す |
| MTCNN が誤検出 | 顔以外を CLIP に投入 | similarity_v1 と同じ閾値なので相対的悪化なし。フロントの「顔が検出できません」エラーは継続 |

---

## 5. テスト戦略

| レイヤー | テスト方法 | 状態 |
|---|---|---|
| rank決定の数学 | `test_clip_engine.py::TestVoteDecisionParity` (stubで完結) | ✅ 実装済 |
| engine切替 | `test_clip_engine.py::TestEngineRegistrySwitching` | ✅ 実装済 |
| CLIP推論パス | 実Imageを与える統合テスト | ⚠ Colabで実モデル+SCUT-FBP5500を使った1度のフィットで代替 |
| HF Space到達 | `/api/health` の `ai:true` 監視 | 既存 |
| 本番ランクの妥当性 | `/learn` ページの biasMap・補正一致率 | 既存UI で確認 |

---

## 6. Phase 2 への接続

Phase 1 が安定したら、以下が短期で導入可能になる(`research-latest-methods_2026-06-18.md` 5章参照):

- **ペアワイズ比較UI**: `/api/diagnose/[id]/correction` に `betterDiagnosisId` を追加するだけ。ペアからの head 再学習スクリプトも `train_clip_head.py` に `--pairs` モードを足す形で拡張可能
- **Ordinal head**: 既存 `_ClipRegressionHead` を Coral Layer 等に差し替えれば head 再学習だけで完結
- **MixAttr**: head 前段に挿す軽量モジュール、CLIP backbone のまま使える

---

## 7. 関連ドキュメント

- `docs/ranking-logic.md` — 現状のロジック説明 (similarity_v1 ベース)
- `docs/research-latest-methods_2026-06-18.md` — 業界最新と長期ロードマップ
- `docs/CORRECTION_LOOP.md` — 補正サンプルの設計
- `docs/rankme-accuracy-investigation.md` — 旧 bias.ts が Spearman を悪化させた実測
- `docs/ai-degraded-incident_2026-06-18.md` — HF Spaces cold start 問題と対策
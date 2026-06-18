# 顔の「綺麗」判定 — 最新研究と Rankme 改善ロードマップ (2026-06-18)

業界の最新研究 (2025-2026) と、Rankme 現行設計とのギャップ分析、移行ロードマップ素案。

---

## 0. TL;DR

1. **業界の事実上の標準** は SCUT-FBP5500 ベンチマーク + ResNet/CLIP 系で **Pearson 0.85〜0.88** が出る世界。Rankme は現状この水準まで到達余地が大きい。
2. **CLIP ViT-L/14 → MLP head** が画像美的評価で支配的アーキテクチャ (LAION 流)。FaceNet (顔認識用) より「綺麗」表現に直接マッピングしやすい。
3. **ペアワイズ比較学習** (A vs B どちらが上?) が絶対値スコアより主観評価ノイズに強い。RankList / ORARS など 2025 の最新パラダイム。
4. **Ordinal Regression head** で 1-10 の順序を保ったまま予測すると、k-NN 投票より頑健。
5. **MixAttr (2026)** や ITM-MGFA (2025) は属性ドメインシフト耐性を高める軽量プラグイン。
6. Rankme の短期改善は「**SCUT-FBP5500 pretrain → CLIP 併用 embedding → Ordinal head → ペアワイズUI**」の順で価値が高い。

---

## 1. 業界ベンチマーク

### SCUT-FBP5500
- 5,500 顔 (男女・アジア/コーカサス・幅広い年齢)
- ラベル: 1〜5 のスコア + スコア分布 + 顔ランドマーク
- AlexNet / ResNet-18 / ResNeXt-50 で **Pearson 0.8777 / MAE 0.2518 / RMSE 0.3325** が達成済 (公式ベンチマーク)
- 出典: [IEEE 2018 (CVPR Workshop)](https://ieeexplore.ieee.org/abstract/document/8546038), [arXiv 1801.06345](https://arxiv.org/pdf/1801.06345)
- 学習コード + 重み: [ustcqidi/BeautyPredict](https://github.com/ustcqidi/BeautyPredict)
- **Rankme への意味**: 5,500 件の事前学習データが無料で使える。自社データ + これで cold start 問題を解消可能。

### AVA (Aesthetic Visual Analysis)
- 25万枚の画像 + 美的スコア。LAION-Aesthetics の元データ。
- 顔特化ではなく汎用美的だが、CLIP+MLP の事前学習に有効。

---

## 2. 最新アーキテクチャ (2024-2026)

### 2.1 CLIP+MLP Aesthetic Predictor (LAION 流) — 業界事実上の標準
- **OpenAI CLIP ViT-L/14** で 768次元 image embedding → 単純な MLP (2-3層) → 0-10 スコア
- Stable Diffusion 等の学習データ選別にも使われる
- 汎用画像で Pearson 0.7、追加 fine-tune で 0.85+ 到達例多数
- 実装: [LAION-AI/aesthetic-predictor](https://github.com/LAION-AI/aesthetic-predictor), [improved-aesthetic-predictor](https://github.com/christophschuhmann/improved-aesthetic-predictor), [simple-aesthetics-predictor](https://github.com/shunk031/simple-aesthetics-predictor)
- 論文: [CLIP knows image aesthetics (Frontiers, 2022)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.976235/full)
- **Rankme への意味**: FaceNet (顔同一性用 embedding) から CLIP (汎用視覚意味embedding) に切替えるだけで、「綺麗」表現に直交していた成分問題が解消する可能性が高い。

### 2.2 MixAttr (2026年1月) — 属性ドメイン汎化
- 顔属性 (年齢/性別/人種) の特徴量統計をミックスして、未見属性ドメインでも崩れない汎化性能を実現
- **plug-and-play**: 既存バックボーンに差し込むだけで動く軽量モジュール
- 論文: [Learning Disentangled Representations via Attribute Mixing (MDPI Symmetry, 2026)](https://www.mdpi.com/2073-8994/18/1/187)
- **Rankme への意味**: スカウト視点 (主観) の偏りに加え、属性ドメイン (例: 自社学習データの年齢層に偏り) があれば、汎化を救うプラグインとして使える。

### 2.3 ITM-MGFA (2025) — マルチモーダル多粒度
- CLIP の **image-text 両モダリティ** から粗粒度+細粒度の美的特徴を統合
- "This face has thick eyebrows" のようなテキスト記述で評価軸を明示可能
- 論文: [A multi-granularity facial aesthetic evaluation model (Elsevier KBS, 2025)](https://www.sciencedirect.com/science/article/abs/pii/S0950705125015412)
- **Rankme への意味**: improvement_areas (skin_quality / hair_balance 等のルールベース) を、CLIP-text と連動した部位別スコアに置き換える展望が開ける。

### 2.4 Aligning Vision Models with Human Aesthetics (NeurIPS 2024)
- CLIP に対し **アライメント fine-tune** で美的スコアを大幅改善
- 論文: [NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/9d3faa41886997cfc2128b930077fa49-Paper-Conference.pdf)
- **Rankme への意味**: 補正サンプル (CorrectionSample) を「人間アライメント信号」として使うパスが理論的に正当化される。

---

## 3. 学習パラダイムの最新 (主観評価の扱い方)

### 3.1 ペアワイズ比較学習 (RankList / ORARS / Beyond Binary)
- 「絶対値スコア」より「A と B どっちが上?」型の **相対判定** の方が主観ノイズに強い
- 2025 の HelpSteer2/3 は **7段階 (-3〜+3) の相対強度ラベル** を採用、 3-6% の精度向上を報告
- 論文:
  - [RankList — Listwise Preference Learning (arXiv 2025/08)](https://arxiv.org/html/2508.09826v1)
  - [Beyond Binary Preferences: Reward Modeling with Ordinal Feedback (arXiv 2026/03)](https://arxiv.org/html/2603.02232)
  - [Modeling Art Evaluations from Comparative Judgments (arXiv 2026/02)](https://arxiv.org/pdf/2602.00394)
- **Rankme への意味**:
  - 補正UI を「A の方が綺麗 / どっちも同じ / B の方が綺麗」型に変えると、絶対値より集めやすく学習効率高い
  - 既存の絶対値補正データもペア化(diagnosis_i 同士の比較)で 1サンプル → C(n,2) ペアに増幅可能

### 3.2 Ordinal Regression
- 1-10 の **順序関係を保ったまま予測**する専用 head (分類でも回帰でもない)
- 隣接ランク誤り (e.g. 5→6) に小さな罰、遠いランク誤り (e.g. 5→9) に大きな罰を非対称に与えられる
- Mean Opinion Score (MOS) 予測 (音声品質評価) で実績多数
- 論文: [Ordinal regression meets online learning (Elsevier EJOR 2025)](https://www.sciencedirect.com/science/article/pii/S0377221725004436)
- **Rankme への意味**: 現在の「k-NN softmax + バケット投票」は近傍依存。Ordinal head ならランクの大局的順序を直接学習できる。

### 3.3 ORARS (Anchored Reference)
- 事前にスコア付けされた**アンカー画像**と比較して相対予測 → 絶対予測
- **Rankme の k-NN 投票方式と思想的に近い**。改良の方向としては「アンカーを各バケットに均等に置く」「Hard Negative を意図的に混ぜる」など。

---

## 4. Rankme 現状とのギャップ

| 現状 | 業界最新 | 課題 | 移行余地 |
|---|---|---|---|
| FaceNet (顔認識用 512次元) | **CLIP ViT-L/14** (汎用美的 768次元) | embedding と rank の Spearman ≈ 0 (実測) | ◎ 効果大・並行運用容易 |
| k-NN cosine + softmax バケット投票 | **MLP head / Ordinal head** で直接予測 | 学習データ拡大時のスケーラビリティ | ○ 並行運用可 |
| 単一スカウトの絶対値 1-10 | **ペアワイズ比較** + 7段階 strength | データ収集効率・ノイズ耐性 | ○ UI 変更必要 |
| Online bias (±1.0 clamp / 20件閾値) | RM (reward modeling) / RLAIF | bias 適用までの長い待ち時間 | △ 設計思想は正しい |
| 1人のスカウト軸固定 | Multi-task (属性) + **MixAttr** | 属性ドメイン外で精度低下 | ○ プラグイン追加 |
| 自社データのみ | SCUT-FBP5500 + AVA で pretrain | cold start・初期精度 | ◎ ライセンス確認後すぐ可 |
| Improvement areas (ルールベース) | **ITM-MGFA** (CLIP-text 連動) | アドバイスの説明力 | △ 中長期 |
| `precompute.py` 手動実行 | 補正サンプル → 自動 retrain CI | 学習サイクルが人手依存 | ○ Cron 化可 |

---

## 5. 改善ロードマップ素案

### Phase 1 — 即効 (1-2週、コード追加最小)

**目的**: Spearman 相関を ≈ 0 から baseline (0.4-0.6) に持ち上げる。

1. **CLIP ViT-L/14 を併用 embedding として導入**
   - `ai/engines/clip_v1.py` を新設 (FaceNet を保持して並走)
   - 入力顔画像 → CLIP image encoder → 768次元 embedding を保存
   - `Diagnosis.embedding` に両方を持てるよう拡張 (`embeddingModel='clip_vit_l14'`)
2. **SCUT-FBP5500 で事前 fit**
   - 5,500顔 + 公式スコアで CLIP+MLP head を学習 (既存重み利用可)
   - `features.npz` に CLIP embedding 版を追加保存
3. **engine_registry を切替可能に**
   - `RANKME_ENGINE=clip_v1` で実行時切替

**期待効果**: 個別予測精度の大幅向上 (Pearson 0.7〜0.8 を狙う)。

### Phase 2 — 中期 (1-2ヶ月)

**目的**: 学習効率と説明性の向上。

4. **ペアワイズ補正UI の追加**
   - `/api/diagnose/[id]/correction` に「ペア比較」型 POST を追加 (`betterDiagnosisId`, `strength: -3..+3`)
   - フロントに 2画像を並べて評価するモードを追加
   - 既存の絶対値補正もペア化して学習に流用
5. **Ordinal Regression head** の試作
   - CLIP embedding → Ordinal MLP (Coral Layer 等)
   - 学習データ: SCUT-FBP5500 (1-5) + 自社補正 (1-10) を同時学習
6. **MixAttr プラグイン** の試験導入
   - 自社データの属性偏りを評価 → MixAttr を head 前段に挿入
   - ablation で効果検証

**期待効果**: スカウト軸の保持 + 属性ドメイン外性能の改善。

### Phase 3 — 長期 (3-6ヶ月)

**目的**: 学習サイクル自動化と公平性。

7. **補正サンプル → 自動 retrain CI**
   - 補正が一定数 (例: 500件) たまったら GitHub Actions で `precompute.py` 相当を再走
   - `features.npz` を HF Space に自動 push、blue-green デプロイ
8. **ITM-MGFA 型のアドバイス生成**
   - improvement_areas のルールベースを CLIP-text 連動の部位別スコアに置換
   - 「skin_quality 6.2 / hair_balance 7.8」のような連続値アドバイスへ
9. **公平性メトリクスの導入**
   - 性別・年齢・人種別の予測精度と平均ランクをダッシュボード化
   - 監査ログ: バイアス suppression が発動した件数を可視化
10. **A/B テスト基盤**
    - 旧 (similarity_v1) と 新 (clip_v1) を並行運用、補正一致率で評価

**期待効果**: Spearman 0.8+ 維持、運用負荷削減、説明責任の向上。

---

## 6. リスクと注意

### 6.1 倫理・公平性
- 顔の美しさ評価は **属性バイアス** (年齢/人種/性別) が混入しやすい
- SCUT-FBP5500 は多様性配慮設計だが、自社データで fine-tune する際は **公平性メトリクス** を必ず併用
- 参考: [Ethically aligned Deep Learning: Unbiased Facial Aesthetic Prediction (arXiv 2021)](https://arxiv.org/pdf/2111.05149)

### 6.2 法務
- EU AI Act の High-Risk AI に該当する可能性 (生体識別・社会的影響)
- 日本: 個人情報保護法・顔の生体情報は機微情報相当
- 商用展開 (特に EEA) 前にコンプラ確認必須

### 6.3 ライセンス
- SCUT-FBP5500: 研究目的限定。商用利用前に著者連絡で確認
- CLIP ViT-L/14: OpenAI のオープン重み (使用可)
- LAION-Aesthetics: CC-BY 4.0、商用可

### 6.4 計算リソース
- CLIP ViT-L/14 は FaceNet より約 3〜4倍重い (推論時間が増える)
- HF Space CPU プランだと cold start + 推論で 30秒超えるリスク → ai-degraded-incident_2026-06-18.md の対策と合わせて検討必要

---

## 7. 関連参考文献 (主要なもの)

### ベンチマーク・データセット
- [SCUT-FBP5500 (IEEE 2018)](https://ieeexplore.ieee.org/abstract/document/8546038) / [arXiv](https://arxiv.org/pdf/1801.06345)
- [BeautyPredict (GitHub 実装集)](https://github.com/ustcqidi/BeautyPredict)
- [LAION-Aesthetics blog](https://laion.ai/blog/laion-aesthetics/)

### CLIP系 美的予測
- [LAION-AI/aesthetic-predictor (GitHub)](https://github.com/LAION-AI/aesthetic-predictor)
- [improved-aesthetic-predictor (CLIP+MLP, 0-10)](https://github.com/christophschuhmann/improved-aesthetic-predictor)
- [simple-aesthetics-predictor (HF transformers 風)](https://github.com/shunk031/simple-aesthetics-predictor)
- [CLIP knows image aesthetics (Frontiers AI 2022)](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2022.976235/full)
- [Aligning Vision Models with Human Aesthetics in Retrieval (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/9d3faa41886997cfc2128b930077fa49-Paper-Conference.pdf)

### 最新手法 (2025-2026)
- [Learning Disentangled Representations via Attribute Mixing — MixAttr (MDPI Symmetry 2026)](https://www.mdpi.com/2073-8994/18/1/187)
- [Multi-granularity facial aesthetic evaluation — ITM-MGFA (Elsevier KBS 2025)](https://www.sciencedirect.com/science/article/abs/pii/S0950705125015412)

### Preference / Ordinal Learning
- [RankList — Listwise Preference (arXiv 2025/08)](https://arxiv.org/html/2508.09826v1)
- [Beyond Binary Preferences: Reward Modeling with Ordinal Feedback (arXiv 2026/03)](https://arxiv.org/html/2603.02232)
- [Ordinal regression meets online learning (Elsevier EJOR 2025)](https://www.sciencedirect.com/science/article/pii/S0377221725004436)
- [Modeling Art Evaluations from Comparative Judgments (arXiv 2026/02)](https://arxiv.org/pdf/2602.00394)
- [Ordinal Regression via Binary Preference vs Simple Regression (arXiv 2207.02454)](https://arxiv.org/pdf/2207.02454)
- [Personalized Recommendations via Active Utility-based Pairwise Sampling (arXiv 2025/08)](https://arxiv.org/html/2508.14911v1)

### 倫理・公平性
- [Ethically aligned Deep Learning: Unbiased Facial Aesthetic Prediction (arXiv 2021)](https://arxiv.org/pdf/2111.05149)

### 日本市場参考
- [顔診断アプリ おすすめランキング 2026年6月 (マイベスト)](https://my-best.com/6442)
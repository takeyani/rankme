# RankMe 機能仕様書

**バージョン**: 1.0
**作成日**: 2026-02-13
**ステータス**: ドラフト
**ソースドキュメント**:
- `specs/SPEC_RANKME.md` v2.5（システム仕様書）
- `docs/requirements/requirements.md` v2.0（要件定義書）
**CCAGI SDK**: v3.5.0

---

## 1. ドキュメント概要

本書は RankMe 視覚評価プラットフォームの機能仕様書である。要件定義書（Phase 1）およびシステム仕様書に基づき、画面仕様・API仕様・データモデル・判定エンジン設計・エラーハンドリング・セキュリティ・インフラ構成を詳細に定義する。

本書は CCAGI SDK Phase 2（設計）の成果物であり、Phase 4（実装）の基盤となる。

### 参照ドキュメント

| ドキュメント | パス | バージョン |
|-------------|------|-----------|
| システム仕様書 | `specs/SPEC_RANKME.md` | v2.5 |
| 要件定義書 | `docs/requirements/requirements.md` | v2.0 |
| デザインシステム | `docs/design/design-system.yml` | （作成予定） |
| UIガイドライン | `docs/design/ui-guidelines.md` | （作成予定） |

### 機能要件トレーサビリティ

| 機能ID | 機能名 | 本書対応セクション |
|--------|--------|-------------------|
| F-001 | 画像アップロード | 3.1, 4.1 |
| F-002 | ランク判定（AI） | 3.2, 4.2, 6 |
| F-003 | 改善アドバイス生成 | 3.3, 7 |
| F-004 | 診断レポート表示 | 3.3 |
| F-005 | 診断結果のDB保存 | 4.1, 5.1 |
| F-006 | 履歴表示 | 3.4, 3.5, 4.3 |
| F-007 | 判定方法の切り替え | 6 |
| F-008 | 顔に点数をつけるUI | 3.3 |
| F-009 | ラベリング手動追加UI | 3.6, 4.4 |

---

## 2. システム概要

### 2.1 アーキテクチャ図

```
                        +---------------------------+
                        |       ユーザー（ブラウザ）    |
                        +-------------+-------------+
                                      |
                                      | HTTPS
                                      v
+---------------------------------------------------------------------+
|                     Docker Compose (ローカル)                         |
|                                                                     |
|  +---------------------------+    +------------------------------+  |
|  |   web (port: 3000)        |    |   ai (port: 8000)            |  |
|  |                           |    |                              |  |
|  |  Next.js App              |    |  FastAPI (Python 3.11+)      |  |
|  |  ├─ フロントエンド (React) |    |  ├─ POST /predict            |  |
|  |  ├─ APIルート              |--->|  ├─ POST /health             |  |
|  |  │  ├─ POST /api/diagnose |    |  └─ Engine Registry          |  |
|  |  │  ├─ GET  /api/history  |    |      ├─ similarity_v1        |  |
|  |  │  ├─ GET  /api/history/:id   |      ├─ cnn_classifier_v1    |  |
|  |  │  ├─ GET  /api/labels   |    |      └─ ...（差し替え可能）   |  |
|  |  │  ├─ POST /api/labels   |    |                              |  |
|  |  │  ├─ PUT  /api/labels/:id    |  GPU: NVIDIA (deploy設定)    |  |
|  |  │  └─ DELETE /api/labels/:id  +------------------------------+  |
|  |  ├─ アドバイス生成モジュール|                                     |
|  |  └─ Prisma ORM            |                                     |
|  +-------------+-------------+                                     |
|                |                                                    |
+---------------------------------------------------------------------+
                 |
                 | TCP (環境変数で接続先指定)
                 v
  +-------------------------------+     +----------------------------+
  | GCP Cloud SQL (PostgreSQL)    |     | GCS (Google Cloud Storage) |
  | ├─ Diagnosis テーブル          |     | └─ 教師データ画像           |
  | ├─ TrainingLabel テーブル      |     |    (1,000枚, ~500MB)       |
  | └─ EngineConfig テーブル       |     +----------------------------+
  +-------------------------------+
```

### 2.2 コンポーネント概要

| コンポーネント | 役割 | 技術 |
|---------------|------|------|
| Webフロントエンド | 画面表示・ユーザー操作 | Next.js (TypeScript), React, Tailwind CSS |
| Web APIサーバー | リクエスト処理・ビジネスロジック | Next.js API Routes (TypeScript) |
| AI推論サービス | ランク判定エンジン | FastAPI (Python 3.11+), PyTorch/TensorFlow |
| アドバイス生成 | 改善アドバイスのテキスト生成 | TypeScript (Webアプリ内モジュール) |
| データベース | 診断結果・ラベリングデータ永続化 | GCP Cloud SQL (PostgreSQL) |
| オブジェクトストレージ | 教師データ画像格納 | GCS (Google Cloud Storage) |
| ORM | DB操作の抽象化 | Prisma 6.0+ |

### 2.3 技術スタック

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| ランタイム | Node.js | 20.x (LTS) |
| 言語 (Web) | TypeScript | 5.3+ (strict mode) |
| フレームワーク (Web) | Next.js | 14+ (App Router) |
| ORM | Prisma | 6.0+ |
| 言語 (AI) | Python | 3.11+ |
| フレームワーク (AI) | FastAPI | 0.100+ |
| 推論ライブラリ | PyTorch / TensorFlow | 実装時選定 |
| コンテナ | Docker Compose | GPU対応 (NVIDIA) |
| DB | PostgreSQL (Cloud SQL) | 15+ |
| ストレージ | GCS | - |
| モジュール方式 | ES Modules | `"type": "module"` |

---

## 3. 画面仕様

### 3.1 トップ / アップロード画面 (SCR-001)

**画面ID**: SCR-001
**画面名**: トップ / アップロード画面
**対象ユーザー**: 一般ユーザー
**目的**: サービスの入口。顔写真のアップロードと診断開始を行う。
**URL**: `/`

#### レイアウト説明

画面中央にタイトル「RankMe」を大きく配置し、その下にサービス概要テキストを簡潔に表示する。中央にアップロードエリア（ダッシュ枠線 + アップロードアイコン）を配置し、ドラッグ＆ドロップまたはクリックによるファイル選択に対応する。アップロードエリアの下に「診断する」ボタンを配置し、フッター付近に「履歴を見る」リンクを配置する。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-001-E01 | アプリタイトル | テキスト (h1) | 「RankMe」を表示 | - |
| SCR-001-E02 | サービス説明 | テキスト (p) | サービス概要を1〜2行で表示 | - |
| SCR-001-E03 | アップロードエリア | ドロップゾーン | ドラッグ＆ドロップまたはクリックでファイル選択ダイアログを開く。ドラッグオーバー時にエリアのスタイルが変化（ハイライト）する | - |
| SCR-001-E04 | アップロードアイコン | アイコン | アップロードエリア中央に配置。ファイル未選択状態で表示 | - |
| SCR-001-E05 | ファイル選択テキスト | テキスト | 「画像をドラッグ＆ドロップ、またはクリックして選択」 | - |
| SCR-001-E06 | プレビュー画像 | 画像 | ファイル選択後にアップロードエリア内にプレビュー表示。アップロードアイコンとファイル選択テキストを置換 | - |
| SCR-001-E07 | ファイル名表示 | テキスト | 選択されたファイル名を表示 | - |
| SCR-001-E08 | ファイル形式エラー | エラーテキスト | 不正な形式の場合「JPEG または PNG 形式の画像を選択してください」と表示 | JPEG, PNG のみ許可 |
| SCR-001-E09 | ファイルサイズエラー | エラーテキスト | サイズ超過の場合「ファイルサイズは 5MB 以下にしてください」と表示 | 最大 5MB |
| SCR-001-E10 | 「診断する」ボタン | ボタン (primary) | ファイル未選択時は disabled。クリックで POST /api/diagnose を呼び出し、SCR-002 へ遷移 | ファイル選択済みであること |
| SCR-001-E11 | アップロードプログレス | プログレスバー | アップロード中に表示。進捗率を可視化 | - |
| SCR-001-E12 | 「履歴を見る」リンク | リンク | クリックで SCR-004 へ遷移 | - |

#### 状態遷移

```
[初期状態] ファイル未選択
    │
    ├─ ファイル選択 (D&D or クリック) → [プレビュー表示]
    │   ├─ バリデーションNG → [エラー表示] → [初期状態]
    │   └─ バリデーションOK → [送信可能状態]
    │
    ├─ 「診断する」クリック → [アップロード中]
    │   ├─ 成功 → SCR-002 へ遷移
    │   └─ 失敗 → [エラー表示]
    │
    └─ 「履歴を見る」クリック → SCR-004 へ遷移
```

---

### 3.2 診断中画面 (SCR-002)

**画面ID**: SCR-002
**画面名**: 診断中画面
**対象ユーザー**: 一般ユーザー
**目的**: AI分析中のローディング状態を表示し、ユーザーに待機を促す。
**URL**: `/diagnose/loading`（または SCR-001 上のモーダル/オーバーレイ）

#### レイアウト説明

画面中央にローディングアニメーション（スピナーまたはパルスアニメーション）を配置し、「AI分析中...」のテキストを表示する。進捗状況を示す補助テキスト（例: 「画像を解析しています」「教師データと照合中」）をステップ的に表示してもよい。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-002-E01 | ローディングアニメーション | アニメーション | スピナーまたはパルスアニメーション。200ms以下のインタラクション。compositor props (transform, opacity) のみ使用 | - |
| SCR-002-E02 | 分析中テキスト | テキスト | 「AI分析中...」を表示 | - |
| SCR-002-E03 | 進捗ステップテキスト | テキスト (任意) | 段階的にテキストを切り替え: 「画像を解析しています」→「教師データと照合中」→「結果を生成しています」 | - |
| SCR-002-E04 | キャンセルリンク | リンク (任意) | 「キャンセル」クリックで SCR-001 に戻る。進行中のリクエストをアボートする | - |

#### ローディング状態

| 状態 | 条件 | 表示 |
|------|------|------|
| 分析中 | API呼び出し開始〜レスポンス受信 | ローディングアニメーション + テキスト |
| 完了 | レスポンス受信 (200) | SCR-003 へ自動遷移 |
| タイムアウト | 5秒超過の場合 | 「分析に時間がかかっています。しばらくお待ちください。」を追加表示 |
| 長時間タイムアウト | 30秒超過の場合 | エラー画面を表示。「もう一度お試しください」ボタンで SCR-001 へ戻る |
| エラー | API エラー (4xx/5xx) | エラーメッセージ表示 + 「もう一度お試しください」ボタン |

#### タイムアウト処理

- **目標応答時間**: 5秒以内 (NFR-005)
- **ソフトタイムアウト**: 5秒 - 追加メッセージ表示
- **ハードタイムアウト**: 30秒 - リクエストアボート、エラー表示
- **リトライ**: ハードタイムアウト後に「もう一度お試しください」でSCR-001 に戻る

---

### 3.3 診断レポート画面 (SCR-003)

**画面ID**: SCR-003
**画面名**: 診断レポート画面
**対象ユーザー**: 一般ユーザー
**目的**: 診断結果（ランク + 改善アドバイス）を「診断書」として表示する。
**URL**: `/diagnose/result/:diagnosisId`
**対応機能**: F-004, F-008

#### レイアウト説明

簡潔な「診断書」レイアウトとする。画面上部に顔画像を表示し、その右側（モバイルでは下側）にランク数値を大きく目立つフォント + アクセントカラーで表示する。ランク数値は10段階のスケールバーとともに提示する。その下に改善アドバイス（3〜5項目）をカード形式で並べる。画面下部に客観性明示文と免責文を表示し、「もう一度診断」「履歴を見る」のアクションボタンを配置する。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-003-E01 | レポートヘッダー | テキスト (h2) | 「診断結果」を表示 | - |
| SCR-003-E02 | 顔画像表示 | 画像 | アップロードされた顔画像をプレビュー表示。サーバー側に永続保存しない（クライアントサイドのみ保持、または一時URL） | - |
| SCR-003-E03 | ランク数値 | テキスト (大文字) | ランク（1〜10）を大きなフォントサイズ + アクセントカラーで表示。例: 「7」 | 1〜10の整数 |
| SCR-003-E04 | ランクラベル | テキスト | 「/ 10」をランク数値の横に表示 | - |
| SCR-003-E05 | ランクスケールバー | ビジュアル | 1〜10のスケールバー。現在のランクの位置をハイライト | - |
| SCR-003-E06 | 改善アドバイスセクション | セクション (h3) | 「改善アドバイス」見出し | - |
| SCR-003-E07 | アドバイスカード (1〜5) | カード | 各改善ポイントをカード形式で表示。番号付きリスト。各カードにアイコン（任意）とテキスト | - |
| SCR-003-E08 | 客観性明示文 | テキスト (注記) | 「本判定は、選別済み画像データとの類似度および傾向分析に基づく客観的結果です。」 | **必須表示** |
| SCR-003-E09 | 免責文 | テキスト (注記) | 「個人の価値や魅力を断定するものではありません。」 | **必須表示** |
| SCR-003-E10 | 「もう一度診断」ボタン | ボタン (primary) | クリックで SCR-001 へ遷移 | - |
| SCR-003-E11 | 「履歴を見る」ボタン | ボタン (secondary) | クリックで SCR-004 へ遷移 | - |

#### 表示ルール

- ランク数値は **1〜10 の整数** のみ表示する
- 類似度の生値、confidence スコア等の内部数値はユーザーに **表示しない**
- 改善アドバイスは **3〜5項目** で構成する
- 客観性明示文と免責文は **常に表示** し、非表示にする手段を設けない
- 使用するエンジンの種別はユーザーに表示しない

#### 状態遷移

```
[SCR-002 から遷移]
    │
    ├─ 「もう一度診断」クリック → SCR-001 へ遷移
    └─ 「履歴を見る」クリック → SCR-004 へ遷移
```

---

### 3.4 履歴一覧画面 (SCR-004)

**画面ID**: SCR-004
**画面名**: 履歴一覧画面
**対象ユーザー**: 一般ユーザー
**目的**: 過去の診断結果の一覧を時系列で表示する。
**URL**: `/history`
**対応機能**: F-006

#### レイアウト説明

画面上部に「診断履歴」の見出しとトップページへ戻るリンクを配置する。中央にテーブルまたはカードリスト形式で過去の診断結果を新しい順に一覧表示する。各行/カードには診断日時、ランク数値を表示する。各項目クリックで SCR-005（履歴詳細画面）に遷移する。データが存在しない場合は空状態メッセージを表示する。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-004-E01 | ページタイトル | テキスト (h2) | 「診断履歴」を表示 | - |
| SCR-004-E02 | トップへ戻るリンク | リンク | SCR-001 へ遷移 | - |
| SCR-004-E03 | 履歴リスト | テーブル/カードリスト | 診断結果を新しい順に表示 | - |
| SCR-004-E04 | 日時カラム | テキスト | 診断日時を `YYYY/MM/DD HH:mm` 形式で表示 | - |
| SCR-004-E05 | ランクカラム | テキスト (バッジ) | ランク数値をバッジ形式で表示 | 1〜10 |
| SCR-004-E06 | 詳細リンク | クリック領域 | 行/カード全体がクリック可能。SCR-005 へ遷移 | - |
| SCR-004-E07 | 空状態メッセージ | テキスト | データ0件時「まだ診断結果がありません。」を表示 | - |
| SCR-004-E08 | ページネーション | ナビゲーション | 20件ごとにページ分割。「前へ」「次へ」ボタン。総件数表示 | - |
| SCR-004-E09 | ローディング | スケルトン | データ取得中にスケルトンUIを表示 | - |

#### ページネーション仕様

- **1ページあたり表示件数**: 20件
- **ソート順**: 診断日時の降順（新しい順）
- **ページ遷移**: カーソルベースページネーション（パフォーマンス考慮）
- **総件数**: ページネーション上部に「全 N 件」を表示

---

### 3.5 履歴詳細画面 (SCR-005)

**画面ID**: SCR-005
**画面名**: 履歴詳細画面
**対象ユーザー**: 一般ユーザー
**目的**: 過去の個別診断結果の詳細を表示する。
**URL**: `/history/:diagnosisId`
**対応機能**: F-006

#### レイアウト説明

SCR-003（診断レポート画面）と同様のレイアウトで過去の診断結果を表示する。ただし、アップロード画像は保存しないため顔画像は表示しない（または「画像は保存されていません」のプレースホルダーを表示する）。ランク数値、改善アドバイス、客観性明示文、免責文を表示する。診断日時と使用エンジン情報（内部参照用に保存されている場合）も表示する。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-005-E01 | 戻るリンク | リンク | SCR-004 へ遷移（「一覧に戻る」） | - |
| SCR-005-E02 | 診断日時 | テキスト | 診断実施日時を `YYYY/MM/DD HH:mm` 形式で表示 | - |
| SCR-005-E03 | ランク数値 | テキスト (大文字) | SCR-003-E03 と同一スタイルでランクを表示 | 1〜10 |
| SCR-005-E04 | ランクスケールバー | ビジュアル | SCR-003-E05 と同一 | - |
| SCR-005-E05 | 改善アドバイス | カードリスト | SCR-003-E07 と同一形式で表示 | - |
| SCR-005-E06 | 客観性明示文 | テキスト (注記) | SCR-003-E08 と同一。**必須表示** | - |
| SCR-005-E07 | 免責文 | テキスト (注記) | SCR-003-E09 と同一。**必須表示** | - |
| SCR-005-E08 | 画像プレースホルダー | テキスト/アイコン | 「画像は保存されていません」を表示 | - |
| SCR-005-E09 | 「もう一度診断」ボタン | ボタン (primary) | SCR-001 へ遷移 | - |

---

### 3.6 ラベリング管理画面 (SCR-006)

**画面ID**: SCR-006
**画面名**: ラベリング管理画面
**対象ユーザー**: 管理者 / ラベラー
**目的**: 教師データの一覧表示・追加・編集・削除を行う。
**URL**: `/admin/labels`
**対応機能**: F-009
**認証**: 不要 (NFR-001)

#### レイアウト説明

画面上部に「ラベリング管理」の見出しと統計サマリー（総登録数、各ランクの画像数）を表示する。その下に画像グリッド形式で登録済みの教師データを表示する。各画像カードにはサムネイル画像とランク数値（1〜10）のセレクターを配置する。画面上部または右上に「新規登録」ボタンを配置し、クリックでアップロードフォームを表示する。ランクでのフィルタリング機能を提供する。

#### UI要素一覧

| ID | 要素名 | 種別 | 動作 | バリデーション |
|----|--------|------|------|---------------|
| SCR-006-E01 | ページタイトル | テキスト (h2) | 「ラベリング管理」を表示 | - |
| SCR-006-E02 | 統計サマリー | カード群 | 総登録数と各ランク（1〜10）の画像数を表示 | - |
| SCR-006-E03 | ランクフィルター | セレクト/タブ | 特定ランクの画像のみ表示。「全て」「1」〜「10」の選択肢 | - |
| SCR-006-E04 | 「新規登録」ボタン | ボタン (primary) | クリックで新規登録モーダル/フォームを表示 | - |
| SCR-006-E05 | 画像グリッド | グリッドレイアウト | 登録済み教師データをサムネイルグリッドで表示。レスポンシブ（2〜4列） | - |
| SCR-006-E06 | 画像カード | カード | サムネイル画像 + ランク表示 + 編集/削除アクション | - |
| SCR-006-E07 | ランクセレクター | ドロップダウン (1〜10) | 各画像カード内に配置。ランク変更時に即座に PUT /api/labels/:id を呼び出し | 1〜10の整数 |
| SCR-006-E08 | 編集ボタン | アイコンボタン | ランクの変更を確定 | - |
| SCR-006-E09 | 削除ボタン | アイコンボタン | 確認ダイアログ表示後に DELETE /api/labels/:id を呼び出し | - |
| SCR-006-E10 | 削除確認ダイアログ | モーダル | 「このラベルを削除しますか？」+ 「削除」「キャンセル」ボタン | - |
| SCR-006-E11 | 新規登録フォーム | モーダル/フォーム | 画像アップロード + ランク選択（1〜10）。「登録」「キャンセル」ボタン | 画像: JPEG/PNG, 5MB以下。ランク: 1〜10 |
| SCR-006-E12 | バッチ操作チェックボックス | チェックボックス | 各画像カードにチェックボックスを配置。複数選択で一括削除が可能 | - |
| SCR-006-E13 | 「一括削除」ボタン | ボタン (danger) | 選択した複数のラベルを一括削除。確認ダイアログ表示後に実行 | 1件以上選択されていること |
| SCR-006-E14 | ページネーション | ナビゲーション | 50件ごとにページ分割 | - |
| SCR-006-E15 | 空状態メッセージ | テキスト | データ0件時「ラベリングデータがありません。新規登録してください。」を表示 | - |

#### 新規登録フロー

```
[「新規登録」ボタン クリック]
    │
    ▼
[新規登録モーダル表示]
    ├─ 画像アップロード（ドラッグ＆ドロップ or ファイル選択）
    ├─ ランク選択（1〜10 ドロップダウン）
    ├─ 「登録」ボタン → POST /api/labels → 成功: モーダル閉じる + リスト更新
    └─ 「キャンセル」ボタン → モーダル閉じる
```

---

## 4. API仕様

### 4.1 診断API

#### POST /api/diagnose

顔画像を受け取り、AI推論サービスでランク判定を行い、改善アドバイスを生成して返却する。診断結果はDBに保存する。

**エンドポイント**: `POST /api/diagnose`
**Content-Type**: `multipart/form-data`

**リクエスト**:

| パラメータ | 種別 | 型 | 必須 | 説明 |
|-----------|------|-----|------|------|
| image | form-data (file) | File | はい | 顔画像ファイル (JPEG/PNG, 最大5MB) |

**レスポンス (200 OK)**:

```json
{
  "diagnosisId": "clxyz123abc",
  "rank": 7,
  "advice": [
    {
      "id": 1,
      "text": "眉の形を整えることで、上位ランクの傾向に近づけます。"
    },
    {
      "id": 2,
      "text": "肌のトーンを均一にすることで、印象が大きく改善されます。"
    },
    {
      "id": 3,
      "text": "髪型のバランスを調整することで、全体的な印象が向上します。"
    }
  ],
  "createdAt": "2026-02-13T10:30:00.000Z"
}
```

**レスポンススキーマ**:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| diagnosisId | string | 診断結果の一意識別子 (CUID) |
| rank | integer (1-10) | AIが算出したランク |
| advice | array of object | 改善アドバイス (3〜5件) |
| advice[].id | integer | アドバイスの連番 |
| advice[].text | string | アドバイスのテキスト |
| createdAt | string (ISO 8601) | 診断実施日時 |

**エラーレスポンス**:

| ステータス | コード | メッセージ |
|-----------|--------|-----------|
| 400 | `INVALID_FILE_TYPE` | JPEG または PNG 形式の画像を選択してください |
| 400 | `FILE_TOO_LARGE` | ファイルサイズは 5MB 以下にしてください |
| 400 | `NO_FILE_PROVIDED` | 画像ファイルが指定されていません |
| 500 | `AI_SERVICE_UNAVAILABLE` | AI推論サービスに接続できません。しばらく経ってからお試しください |
| 500 | `AI_INFERENCE_FAILED` | AI推論中にエラーが発生しました |
| 500 | `DB_SAVE_FAILED` | 診断結果の保存に失敗しました |
| 504 | `AI_TIMEOUT` | AI推論がタイムアウトしました |

**エラーレスポンス形式**:

```json
{
  "error": {
    "code": "INVALID_FILE_TYPE",
    "message": "JPEG または PNG 形式の画像を選択してください"
  }
}
```

---

### 4.2 AI推論API (内部)

#### POST /predict

AI推論サービスの共通インターフェース。全判定エンジンがこの契約に準拠する。Webアプリからのみ呼び出される内部API。

**エンドポイント**: `POST /predict`（AI推論サービス: `http://ai:8000/predict`）
**Content-Type**: `multipart/form-data` または `application/json`

**リクエスト (multipart/form-data)**:

| パラメータ | 種別 | 型 | 必須 | 説明 |
|-----------|------|-----|------|------|
| file | form-data (file) | File | はい | 顔画像ファイル (JPEG/PNG) |

**リクエスト (application/json - Base64)**:

```json
{
  "image_base64": "<Base64エンコード済み画像データ>",
  "format": "jpeg"
}
```

**レスポンス (200 OK)**:

```json
{
  "rank": 7,
  "confidence": 0.85,
  "engine": "similarity_v1",
  "advice_context": {
    "nearest_upper_rank": 8,
    "improvement_areas": [
      "eyebrow_shape",
      "skin_tone_uniformity",
      "hair_balance"
    ],
    "similarity_scores": {
      "rank_6": 0.72,
      "rank_7": 0.85,
      "rank_8": 0.61
    },
    "feature_analysis": {
      "face_symmetry": 0.78,
      "skin_quality": 0.65,
      "facial_proportion": 0.82
    }
  },
  "processing_time_ms": 1200
}
```

**レスポンススキーマ**:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| rank | integer (1-10) | 算出されたランク |
| confidence | float (0.0-1.0) | 判定の確信度 |
| engine | string | 使用した判定エンジン名 |
| advice_context | object | アドバイス生成に必要なコンテキスト情報 |
| advice_context.nearest_upper_rank | integer | 最も近い上位ランク |
| advice_context.improvement_areas | array of string | 改善推奨領域のキー一覧 |
| advice_context.similarity_scores | object | 各ランクとの類似度スコア |
| advice_context.feature_analysis | object | 顔特徴の分析結果 |
| processing_time_ms | integer | 推論処理時間（ミリ秒） |

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `INVALID_IMAGE` | 画像の読み込みに失敗 |
| 400 | `NO_FACE_DETECTED` | 顔が検出されなかった |
| 500 | `ENGINE_NOT_FOUND` | 指定されたエンジンが見つからない |
| 500 | `INFERENCE_ERROR` | 推論処理中のエラー |
| 503 | `MODEL_NOT_LOADED` | モデルが未読み込み |

#### GET /health

AI推論サービスのヘルスチェックエンドポイント。

**エンドポイント**: `GET /health`

**レスポンス (200 OK)**:

```json
{
  "status": "healthy",
  "engine": "similarity_v1",
  "model_loaded": true,
  "gpu_available": true,
  "uptime_seconds": 3600
}
```

---

### 4.3 履歴API

#### GET /api/history

診断結果の履歴を一覧取得する。

**エンドポイント**: `GET /api/history`

**クエリパラメータ**:

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| cursor | string | いいえ | null | ページネーション用カーソル（diagnosisId） |
| limit | integer | いいえ | 20 | 1ページあたりの取得件数 (最大: 100) |

**レスポンス (200 OK)**:

```json
{
  "items": [
    {
      "diagnosisId": "clxyz123abc",
      "rank": 7,
      "createdAt": "2026-02-13T10:30:00.000Z"
    },
    {
      "diagnosisId": "clxyz456def",
      "rank": 5,
      "createdAt": "2026-02-12T14:20:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "clxyz456def",
    "hasMore": true,
    "totalCount": 42
  }
}
```

**レスポンススキーマ**:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| items | array of object | 診断結果リスト |
| items[].diagnosisId | string | 診断ID |
| items[].rank | integer (1-10) | ランク |
| items[].createdAt | string (ISO 8601) | 診断日時 |
| pagination.nextCursor | string or null | 次ページのカーソル |
| pagination.hasMore | boolean | 次ページが存在するか |
| pagination.totalCount | integer | 総件数 |

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `INVALID_CURSOR` | 不正なカーソル値 |
| 400 | `INVALID_LIMIT` | limitの範囲外 (1〜100) |
| 500 | `DB_CONNECTION_ERROR` | データベース接続エラー |

---

#### GET /api/history/:id

指定した診断結果の詳細を取得する。

**エンドポイント**: `GET /api/history/:id`

**パスパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | はい | 診断結果のID (diagnosisId) |

**レスポンス (200 OK)**:

```json
{
  "diagnosisId": "clxyz123abc",
  "rank": 7,
  "advice": [
    {
      "id": 1,
      "text": "眉の形を整えることで、上位ランクの傾向に近づけます。"
    },
    {
      "id": 2,
      "text": "肌のトーンを均一にすることで、印象が大きく改善されます。"
    },
    {
      "id": 3,
      "text": "髪型のバランスを調整することで、全体的な印象が向上します。"
    }
  ],
  "engineType": "similarity_v1",
  "createdAt": "2026-02-13T10:30:00.000Z"
}
```

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 404 | `DIAGNOSIS_NOT_FOUND` | 指定されたIDの診断結果が見つからない |
| 500 | `DB_CONNECTION_ERROR` | データベース接続エラー |

---

### 4.4 ラベリングAPI

#### GET /api/labels

登録済み教師データラベルの一覧を取得する。

**エンドポイント**: `GET /api/labels`

**クエリパラメータ**:

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| rank | integer (1-10) | いいえ | null | ランクでフィルタリング |
| cursor | string | いいえ | null | ページネーション用カーソル |
| limit | integer | いいえ | 50 | 1ページあたりの取得件数 (最大: 100) |

**レスポンス (200 OK)**:

```json
{
  "items": [
    {
      "id": "label_001",
      "imageUrl": "https://storage.googleapis.com/rankme-training/rank7/img_001.jpg",
      "thumbnailUrl": "https://storage.googleapis.com/rankme-training/rank7/thumb_img_001.jpg",
      "rank": 7,
      "labeledBy": "labeler_a",
      "createdAt": "2026-02-10T08:00:00.000Z",
      "updatedAt": "2026-02-10T08:00:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "label_001",
    "hasMore": true,
    "totalCount": 1000
  },
  "summary": {
    "total": 1000,
    "byRank": {
      "1": 100, "2": 100, "3": 100, "4": 100, "5": 100,
      "6": 100, "7": 100, "8": 100, "9": 100, "10": 100
    }
  }
}
```

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `INVALID_RANK` | ランク値が1〜10の範囲外 |
| 500 | `DB_CONNECTION_ERROR` | データベース接続エラー |

---

#### POST /api/labels

新しい教師データラベルを登録する。

**エンドポイント**: `POST /api/labels`
**Content-Type**: `multipart/form-data`

**リクエスト**:

| パラメータ | 種別 | 型 | 必須 | 説明 |
|-----------|------|-----|------|------|
| image | form-data (file) | File | はい | 教師データ画像 (JPEG/PNG, 最大5MB) |
| rank | form-data (field) | integer | はい | ランク (1〜10) |
| labeledBy | form-data (field) | string | いいえ | ラベル付与者の識別子 |

**レスポンス (201 Created)**:

```json
{
  "id": "label_1001",
  "imageUrl": "https://storage.googleapis.com/rankme-training/rank7/img_1001.jpg",
  "thumbnailUrl": "https://storage.googleapis.com/rankme-training/rank7/thumb_img_1001.jpg",
  "rank": 7,
  "labeledBy": "labeler_a",
  "createdAt": "2026-02-13T12:00:00.000Z",
  "updatedAt": "2026-02-13T12:00:00.000Z"
}
```

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `INVALID_FILE_TYPE` | JPEG/PNG以外のファイル形式 |
| 400 | `FILE_TOO_LARGE` | 5MBを超えるファイル |
| 400 | `INVALID_RANK` | ランク値が1〜10の範囲外 |
| 400 | `NO_FILE_PROVIDED` | 画像ファイルが指定されていない |
| 500 | `UPLOAD_FAILED` | GCSへのアップロード失敗 |
| 500 | `DB_SAVE_FAILED` | DB保存失敗 |

---

#### PUT /api/labels/:id

既存の教師データラベルのランクを更新する。

**エンドポイント**: `PUT /api/labels/:id`
**Content-Type**: `application/json`

**パスパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | はい | ラベルID |

**リクエストボディ**:

```json
{
  "rank": 8,
  "labeledBy": "labeler_b"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| rank | integer (1-10) | はい | 新しいランク値 |
| labeledBy | string | いいえ | 更新者の識別子 |

**レスポンス (200 OK)**:

```json
{
  "id": "label_001",
  "imageUrl": "https://storage.googleapis.com/rankme-training/rank8/img_001.jpg",
  "rank": 8,
  "labeledBy": "labeler_b",
  "createdAt": "2026-02-10T08:00:00.000Z",
  "updatedAt": "2026-02-13T15:00:00.000Z"
}
```

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `INVALID_RANK` | ランク値が1〜10の範囲外 |
| 404 | `LABEL_NOT_FOUND` | 指定されたIDのラベルが見つからない |
| 500 | `DB_SAVE_FAILED` | DB更新失敗 |

---

#### DELETE /api/labels/:id

教師データラベルを削除する。

**エンドポイント**: `DELETE /api/labels/:id`

**パスパラメータ**:

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | はい | ラベルID |

**レスポンス (204 No Content)**:

レスポンスボディなし。

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 404 | `LABEL_NOT_FOUND` | 指定されたIDのラベルが見つからない |
| 500 | `DELETE_FAILED` | 削除処理失敗 |
| 500 | `GCS_DELETE_FAILED` | GCSからの画像削除失敗 |

---

#### DELETE /api/labels (バッチ削除)

複数の教師データラベルを一括削除する。

**エンドポイント**: `DELETE /api/labels`
**Content-Type**: `application/json`

**リクエストボディ**:

```json
{
  "ids": ["label_001", "label_002", "label_003"]
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| ids | array of string | はい | 削除対象のラベルIDリスト (最大: 100件) |

**レスポンス (200 OK)**:

```json
{
  "deleted": 3,
  "failed": 0,
  "errors": []
}
```

**エラーレスポンス**:

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `EMPTY_IDS` | IDリストが空 |
| 400 | `TOO_MANY_IDS` | 100件を超えるIDが指定された |

---

## 5. データモデル

### 5.1 Diagnosis（診断結果）

診断結果を格納するテーブル。アップロード画像はDB保存しない。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (CUID) | PK | 診断結果の一意識別子 |
| rank | Int | NOT NULL, CHECK (1-10) | AIが算出したランク (1〜10) |
| advice | Json | NOT NULL | 改善アドバイス (配列: [{id, text}]) |
| adviceContext | Json | NULL許容 | AI推論からの詳細コンテキスト（内部参照用） |
| engineType | String | NOT NULL | 使用した判定エンジン名 |
| processingTimeMs | Int | NULL許容 | AI推論処理時間（ミリ秒） |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 診断実施日時 |

**Prisma スキーマ**:

```prisma
model Diagnosis {
  id               String   @id @default(cuid())
  rank             Int      @db.SmallInt
  advice           Json     // [{id: number, text: string}]
  adviceContext     Json?    // AI推論からのコンテキスト情報（内部参照用）
  engineType       String   @db.VarChar(50)
  processingTimeMs Int?
  createdAt        DateTime @default(now())

  @@index([createdAt(sort: Desc)])
  @@map("diagnoses")
}
```

---

### 5.2 TrainingLabel（教師データラベル）

教師データの画像とランクの対応を管理するテーブル。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (CUID) | PK | ラベルの一意識別子 |
| imageUrl | String | NOT NULL | GCS上の画像URL |
| thumbnailUrl | String | NULL許容 | サムネイル画像URL |
| rank | Int | NOT NULL, CHECK (1-10) | ラベル付けされたランク (1〜10) |
| labeledBy | String | NULL許容 | ラベル付与者の識別子 |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 登録日時 |
| updatedAt | DateTime | NOT NULL, @updatedAt | 最終更新日時 |

**Prisma スキーマ**:

```prisma
model TrainingLabel {
  id           String   @id @default(cuid())
  imageUrl     String
  thumbnailUrl String?
  rank         Int      @db.SmallInt
  labeledBy    String?  @db.VarChar(100)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([rank])
  @@index([createdAt(sort: Desc)])
  @@map("training_labels")
}
```

---

### 5.3 EngineConfig（判定エンジン設定）

利用可能な判定エンジンの設定を管理するテーブル。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | String (CUID) | PK | エンジン設定の一意識別子 |
| name | String | NOT NULL, UNIQUE | エンジン名 (例: similarity_v1) |
| displayName | String | NOT NULL | 表示用エンジン名 |
| type | String | NOT NULL | エンジンの種類 (similarity, classifier, hybrid) |
| version | String | NOT NULL | バージョン番号 |
| description | String | NULL許容 | エンジンの説明 |
| config | Json | NULL許容 | エンジン固有の設定パラメータ |
| isActive | Boolean | NOT NULL, DEFAULT false | 現在アクティブか |
| createdAt | DateTime | NOT NULL, DEFAULT now() | 登録日時 |
| updatedAt | DateTime | NOT NULL, @updatedAt | 最終更新日時 |

**Prisma スキーマ**:

```prisma
model EngineConfig {
  id          String   @id @default(cuid())
  name        String   @unique @db.VarChar(50)
  displayName String   @db.VarChar(100)
  type        String   @db.VarChar(30) // "similarity" | "classifier" | "hybrid"
  version     String   @db.VarChar(20)
  description String?
  config      Json?    // エンジン固有の設定パラメータ
  isActive    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("engine_configs")
}
```

---

### 5.4 ER図

```
+------------------+
|    Diagnosis     |
+------------------+
| id          (PK) |
| rank             |
| advice           |
| adviceContext     |
| engineType       |
| processingTimeMs |
| createdAt        |
+------------------+

+-------------------+
|  TrainingLabel    |
+-------------------+
| id           (PK) |
| imageUrl          |
| thumbnailUrl      |
| rank              |
| labeledBy         |
| createdAt         |
| updatedAt         |
+-------------------+

+-------------------+
|  EngineConfig     |
+-------------------+
| id           (PK) |
| name         (UQ) |
| displayName       |
| type              |
| version           |
| description       |
| config            |
| isActive          |
| createdAt         |
| updatedAt         |
+-------------------+
```

**テーブル間リレーション**: 現時点では明示的な外部キーリレーションは設けない。`Diagnosis.engineType` は `EngineConfig.name` と論理的に対応するが、FK制約は設けず疎結合とする。これにより、エンジン設定の追加・変更が既存の診断結果に影響を与えないようにする。

---

## 6. 判定エンジン共通インターフェース

### 6.1 概要

RankMe の判定エンジンは、異なるモデル・学習方法を同一のインターフェースで差し替え可能にする設計とする。全エンジンが以下の共通契約に準拠する。

### 6.2 共通インターフェース定義

**入力**:
- 顔画像 1枚（JPEG / PNG）

**出力**:
- `rank`: ランク 1〜10（整数）
- `confidence`: 確信度 0.0〜1.0（浮動小数点）
- `advice_context`: 改善アドバイス生成に必要なコンテキスト情報（オブジェクト）

**プロトコル**: REST API `POST /predict`（JSON返却）

### 6.3 エンジン切り替え機構

**環境変数**: `RANKME_ENGINE`

```bash
# 環境変数で指定
RANKME_ENGINE=similarity_v1     # 類似度ベースエンジン v1
RANKME_ENGINE=cnn_classifier_v1 # CNN分類器エンジン v1
RANKME_ENGINE=hybrid_v1         # ハイブリッドエンジン v1
```

### 6.4 Engine Registry パターン

AI推論サービス（FastAPI）内部で Engine Registry パターンを採用する。

```python
# エンジンレジストリの概念設計

from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseEngine(ABC):
    """全判定エンジンの基底クラス"""

    @abstractmethod
    def predict(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        共通インターフェース

        Args:
            image_bytes: 顔画像のバイトデータ

        Returns:
            {
                "rank": int,          # 1〜10
                "confidence": float,  # 0.0〜1.0
                "advice_context": {   # アドバイス生成用コンテキスト
                    "nearest_upper_rank": int,
                    "improvement_areas": list[str],
                    "similarity_scores": dict,
                    "feature_analysis": dict
                }
            }
        """
        pass

    @abstractmethod
    def load_model(self) -> None:
        """モデルの読み込み"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """エンジン名"""
        pass


class EngineRegistry:
    """エンジン管理レジストリ"""

    _engines: Dict[str, type[BaseEngine]] = {}

    @classmethod
    def register(cls, name: str, engine_class: type[BaseEngine]):
        cls._engines[name] = engine_class

    @classmethod
    def get(cls, name: str) -> BaseEngine:
        if name not in cls._engines:
            raise ValueError(f"Engine '{name}' not found. Available: {list(cls._engines.keys())}")
        return cls._engines[name]()

    @classmethod
    def list_engines(cls) -> list[str]:
        return list(cls._engines.keys())
```

### 6.5 エンジン一覧（想定）

| エンジン名 | type | 説明 | 手法 |
|-----------|------|------|------|
| similarity_v1 | similarity | 類似度ベース v1 | 教師データとの特徴量コサイン類似度 |
| cnn_classifier_v1 | classifier | CNN分類器 v1 | 畳み込みニューラルネットワークによる分類 |
| hybrid_v1 | hybrid | ハイブリッド v1 | 類似度 + 分類器のアンサンブル |

### 6.6 起動時の動作

1. Docker Compose 起動時に `RANKME_ENGINE` 環境変数を読み取る
2. AI推論サービス (FastAPI) が `EngineRegistry` から該当エンジンを取得
3. エンジンの `load_model()` でモデルを GPU メモリに読み込み
4. `/predict` エンドポイントが選択されたエンジンの `predict()` を呼び出す
5. `/health` エンドポイントでエンジンの状態（モデル読み込み済み、GPU利用可能）を確認可能

---

## 7. 改善アドバイス生成ロジック

### 7.1 概要

改善アドバイス生成モジュールは、Webアプリケーション内（TypeScript）に配置する。AI推論サービスから返却された `advice_context` を入力として、ユーザー向けの日本語テキストを生成する。

### 7.2 入力

| フィールド | 型 | 説明 |
|-----------|-----|------|
| rank | integer (1-10) | 算出されたランク |
| advice_context.nearest_upper_rank | integer | 最も近い上位ランク |
| advice_context.improvement_areas | string[] | 改善推奨領域のキー一覧 |
| advice_context.feature_analysis | object | 顔特徴の分析結果 |

### 7.3 出力

| フィールド | 型 | 説明 |
|-----------|-----|------|
| advice | array of {id, text} | 改善アドバイス 3〜5件 |

### 7.4 生成ルール

1. **アドバイス件数**: 3〜5件で構成する
   - ランク 1〜3: 5件（改善ポイントが多い）
   - ランク 4〜6: 4件
   - ランク 7〜9: 3件
   - ランク 10: 3件（微調整レベル）

2. **改善領域とテキストのマッピング**: `improvement_areas` のキーに基づき、テンプレートテキストを選択・生成する

3. **テンプレート例**:

| improvement_area キー | アドバイステキスト例 |
|----------------------|---------------------|
| eyebrow_shape | 眉の形を整えることで、上位ランクの傾向に近づけます。 |
| skin_tone_uniformity | 肌のトーンを均一にすることで、印象が大きく改善されます。 |
| hair_balance | 髪型のバランスを調整することで、全体的な印象が向上します。 |
| face_symmetry | 左右対称性を意識したメイクアップで、バランスが向上します。 |
| facial_proportion | 顔のプロポーションを活かしたヘアスタイルで印象が変わります。 |
| skin_quality | スキンケアの見直しにより、肌質の改善が期待できます。 |
| eye_impression | 目元の印象を強調することで、評価ポイントが向上します。 |
| overall_grooming | 全体的な手入れの行き届いた印象が、上位ランクの特徴です。 |

4. **ランク10の場合**: 改善というよりも「維持」「微調整」のニュアンスでアドバイスを生成する

5. **禁止事項**:
   - 美醜を直接的に評価する表現は使用しない
   - 個人の価値を否定する表現は使用しない
   - ネガティブな表現よりもポジティブな改善提案を優先する
   - 類似度の生値やスコア数値はテキストに含めない

### 7.5 将来拡張

- LLM（大規模言語モデル）によるアドバイスの動的生成への切り替えを検討
- `advice_context` の情報をプロンプトに含めることで、より具体的・パーソナライズされたアドバイスを生成可能

---

## 8. エラーハンドリング

### 8.1 エラーコード一覧

| コード | HTTPステータス | カテゴリ | ユーザー向けメッセージ |
|--------|--------------|---------|----------------------|
| `INVALID_FILE_TYPE` | 400 | バリデーション | JPEG または PNG 形式の画像を選択してください |
| `FILE_TOO_LARGE` | 400 | バリデーション | ファイルサイズは 5MB 以下にしてください |
| `NO_FILE_PROVIDED` | 400 | バリデーション | 画像ファイルが指定されていません |
| `INVALID_RANK` | 400 | バリデーション | ランクは 1〜10 の範囲で指定してください |
| `INVALID_CURSOR` | 400 | バリデーション | ページ情報が不正です |
| `INVALID_LIMIT` | 400 | バリデーション | 取得件数の指定が不正です |
| `EMPTY_IDS` | 400 | バリデーション | 削除対象を指定してください |
| `TOO_MANY_IDS` | 400 | バリデーション | 一括削除は 100 件までです |
| `INVALID_IMAGE` | 400 | AI推論 | 画像の読み込みに失敗しました |
| `NO_FACE_DETECTED` | 400 | AI推論 | 顔が検出できませんでした。正面からの顔写真をお試しください |
| `DIAGNOSIS_NOT_FOUND` | 404 | リソース | 指定された診断結果が見つかりません |
| `LABEL_NOT_FOUND` | 404 | リソース | 指定されたラベルが見つかりません |
| `AI_SERVICE_UNAVAILABLE` | 500 | システム | AI推論サービスに接続できません。しばらく経ってからお試しください |
| `AI_INFERENCE_FAILED` | 500 | システム | AI推論中にエラーが発生しました。もう一度お試しください |
| `ENGINE_NOT_FOUND` | 500 | システム | 判定エンジンの設定に問題があります |
| `MODEL_NOT_LOADED` | 503 | システム | システムの準備中です。しばらくお待ちください |
| `DB_CONNECTION_ERROR` | 500 | システム | データベースに接続できません |
| `DB_SAVE_FAILED` | 500 | システム | データの保存に失敗しました |
| `UPLOAD_FAILED` | 500 | システム | ファイルのアップロードに失敗しました |
| `DELETE_FAILED` | 500 | システム | 削除処理に失敗しました |
| `GCS_DELETE_FAILED` | 500 | システム | ストレージからの削除に失敗しました |
| `AI_TIMEOUT` | 504 | タイムアウト | AI推論がタイムアウトしました。もう一度お試しください |

### 8.2 エラーレスポンス形式

全APIで統一したエラーレスポンス形式を使用する。

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "ユーザー向けメッセージ",
    "details": {}
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| error.code | string | エラーコード（機械可読） |
| error.message | string | ユーザー向けエラーメッセージ（日本語） |
| error.details | object (任意) | 追加情報（デバッグ用。本番環境では最小限） |

### 8.3 リトライポリシー

| 対象 | リトライ回数 | 間隔 | 条件 |
|------|------------|------|------|
| AI推論サービスへの呼び出し | 2回 | 1秒, 3秒（指数バックオフ） | 500, 503, タイムアウト |
| DB保存 | 1回 | 1秒 | 接続エラーのみ |
| GCSアップロード | 2回 | 1秒, 2秒 | 500, タイムアウト |
| GCS削除 | 1回 | 1秒 | 500, タイムアウト |

### 8.4 フロントエンドでのエラー表示

| エラー種別 | 表示方法 |
|-----------|---------|
| バリデーションエラー (400) | フォーム要素の近くにインラインエラーメッセージ |
| リソース未検出 (404) | 専用の404ページまたは空状態表示 |
| システムエラー (500) | トースト通知 + 「もう一度お試しください」ボタン |
| タイムアウト (504) | ローディング画面にメッセージ追加 + リトライボタン |

---

## 9. セキュリティ考慮事項

### 9.1 認証・認可

- **認証不要** (NFR-001): 全機能（診断・履歴・ラベリング）に認証なしでアクセス可能
- **将来的な認証追加**: CC-Auth設定は準備済み（要件定義書 セクション11）。認証追加時はミドルウェアの追加のみで対応可能な設計とする

### 9.2 画像の取り扱い

| ポリシー | 内容 |
|---------|------|
| アップロード画像の永続保存 | **しない**。AI推論用に一時的に使用し、推論完了後に破棄する |
| 一時保存の上限 | 推論処理中のみメモリ上に保持。ディスクへの書き込みは行わないことを推奨 |
| 教師データ画像 | GCSに保存。アクセス制御はGCSのIAM設定で管理 |
| クライアント側プレビュー | `URL.createObjectURL()` でブラウザメモリ上にのみ保持 |

### 9.3 入力バリデーション

| チェック項目 | 実装場所 | 内容 |
|------------|---------|------|
| ファイル形式 | フロント + API | MIME type チェック (image/jpeg, image/png) |
| ファイルサイズ | フロント + API | 最大 5MB |
| ファイルヘッダー | API | マジックバイトの検証（偽装防止） |
| ランク値 | API | 整数 1〜10 の範囲チェック |
| 文字列入力 | API | XSS対策（HTMLエスケープ） |
| パスパラメータ | API | CUID形式の検証 |

### 9.4 レート制限

| エンドポイント | 制限 | 備考 |
|---------------|------|------|
| POST /api/diagnose | 10回/分/IP | AI推論リソース保護 |
| GET /api/history | 30回/分/IP | 通常のブラウジング想定 |
| POST /api/labels | 20回/分/IP | 教師データ登録 |
| DELETE /api/labels | 10回/分/IP | 一括削除の濫用防止 |

### 9.5 OWASP Top 10 対策

| 脅威 | 対策 |
|------|------|
| XSS | React のデフォルトエスケープ。dangerouslySetInnerHTML は使用しない |
| CSRF | SameSite Cookie。APIルートでのオリジン検証 |
| インジェクション | Prisma の parameterized query。入力値のサニタイズ |
| SSRF | AI推論サービスは内部ネットワークのみ。外部URLの受付なし |
| ファイルアップロード | 形式・サイズ制限。マジックバイト検証。実行ファイルの拒否 |

### 9.6 通信セキュリティ

| 区間 | プロトコル | 備考 |
|------|-----------|------|
| ユーザー → Webアプリ | HTTPS (TLS 1.2+) | 本番環境は必須 |
| Webアプリ → AI推論 | HTTP | Docker Compose内部ネットワーク |
| Webアプリ → Cloud SQL | TLS | Cloud SQL Proxy 推奨 |
| Webアプリ → GCS | HTTPS | GCS クライアントライブラリ |

---

## 10. Docker Compose 仕様

### 10.1 サービス構成

```yaml
version: "3.8"

services:
  # --- Web アプリケーション ---
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - AI_SERVICE_URL=http://ai:8000
      - DATABASE_URL=${DATABASE_URL}
      - GCS_BUCKET=${GCS_BUCKET}
      - GCS_PROJECT_ID=${GCS_PROJECT_ID}
    depends_on:
      ai:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  # --- AI 推論サービス ---
  ai:
    build:
      context: ./ai
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - RANKME_ENGINE=${RANKME_ENGINE:-similarity_v1}
      - MODEL_PATH=/models
      - DEVICE=cuda
      - MAX_BATCH_SIZE=1
    volumes:
      - ./models:/models:ro
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    restart: unless-stopped
```

### 10.2 GPU設定

| 項目 | 値 | 説明 |
|------|-----|------|
| GPU ドライバー | nvidia | NVIDIA Container Toolkit 必須 |
| GPU 数 | 1 | 最小構成。スケール時に増設 |
| capabilities | [gpu] | GPU演算機能の有効化 |
| DEVICE 環境変数 | cuda | PyTorch/TensorFlow で GPU 使用 |

**前提条件**:
- ホストOSに NVIDIA GPU ドライバーがインストール済み
- NVIDIA Container Toolkit がインストール済み
- `nvidia-smi` コマンドが正常動作すること

### 10.3 環境変数一覧

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `RANKME_ENGINE` | いいえ | `similarity_v1` | 使用する判定エンジン名 |
| `AI_SERVICE_URL` | いいえ | `http://ai:8000` | AI推論サービスのURL |
| `DATABASE_URL` | はい | - | PostgreSQL接続文字列 (Cloud SQL) |
| `GCS_BUCKET` | はい | - | GCSバケット名 |
| `GCS_PROJECT_ID` | はい | - | GCPプロジェクトID |
| `GOOGLE_APPLICATION_CREDENTIALS` | はい | - | GCPサービスアカウントキーのパス |
| `NODE_ENV` | いいえ | `development` | 実行環境 |
| `MODEL_PATH` | いいえ | `/models` | AI モデルファイルのパス |
| `DEVICE` | いいえ | `cuda` | 推論デバイス (cuda / cpu) |
| `MAX_BATCH_SIZE` | いいえ | `1` | 推論バッチサイズ |

### 10.4 ボリュームマウント

| ホスト | コンテナ | モード | 用途 |
|--------|---------|-------|------|
| `./models` | `/models` | 読み取り専用 (ro) | 学習済みモデルファイル |

### 10.5 ヘルスチェック

| サービス | エンドポイント | 間隔 | タイムアウト | リトライ | 開始猶予 |
|---------|---------------|------|------------|---------|---------|
| web | `GET /api/health` | 30秒 | 10秒 | 3回 | 10秒 |
| ai | `GET /health` | 30秒 | 10秒 | 5回 | 30秒 |

### 10.6 起動手順

```bash
# 1. 環境変数の設定
cp .env.example .env
# .env を編集して DATABASE_URL, GCS_BUCKET 等を設定

# 2. モデルファイルの配置
# ./models/ ディレクトリに学習済みモデルを配置

# 3. 起動
docker compose up -d

# 4. ヘルスチェック確認
docker compose ps
curl http://localhost:3000/api/health
curl http://localhost:8000/health

# 5. 停止
docker compose down
```

---

## 11. 外部インフラ (GCP)

### 11.1 データベース（Cloud SQL）

**推奨構成**: Cloud SQL for PostgreSQL

| 項目 | 開発環境 | 本番環境 |
|------|---------|---------|
| インスタンスタイプ | db-f1-micro | db-custom-2-7680 |
| PostgreSQL バージョン | 15 | 15 |
| ストレージ | 10GB SSD | 50GB SSD |
| 高可用性 (HA) | 無効 | 有効 |
| 自動バックアップ | 日次 | 日次 + PITR |
| リージョン | asia-northeast1 (東京) | asia-northeast1 (東京) |

**接続方法**:

```
# DATABASE_URL 形式
postgresql://USER:PASSWORD@HOST:5432/rankme?schema=public

# Cloud SQL Proxy 経由の場合
postgresql://USER:PASSWORD@localhost:5432/rankme?schema=public&host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

**代替案: Firestore**

ドキュメント型DBとしてFirestoreも選択肢に含まれる。Prismaは Firestore をネイティブサポートしないため、Cloud SQL (PostgreSQL) を第一候補とする。Firestoreを選択する場合はPrismaを使用せず、Firestore SDKで直接操作する設計となる。

### 11.2 オブジェクトストレージ（GCS）

**バケット構成**:

| バケット名 | 用途 | アクセス |
|-----------|------|---------|
| `rankme-training-{env}` | 教師データ画像 | サービスアカウントのみ |

**ディレクトリ構造**:

```
rankme-training-dev/
├── rank1/
│   ├── img_001.jpg
│   ├── thumb_img_001.jpg
│   └── ...
├── rank2/
│   └── ...
├── ...
└── rank10/
    └── ...
```

**ストレージ設定**:

| 項目 | 値 |
|------|-----|
| ストレージクラス | Standard |
| リージョン | asia-northeast1 (東京) |
| 想定容量 | 1,000枚 約 500MB（初期） |
| ライフサイクル | 設定なし（教師データは永続保持） |

### 11.3 GCP サービスアカウント

| 権限 | 用途 |
|------|------|
| Cloud SQL Client | DB接続 |
| Storage Object Admin | GCSへの読み書き |

### 11.4 ネットワーク構成（本番環境）

```
[インターネット]
    │
    ▼
[Cloud Load Balancer + Cloud CDN]
    │
    ▼
[Cloud Run / Compute Engine] ← Web アプリ
    │
    ├─ VPC Connector ──► [Compute Engine (GPU)] ← AI推論
    │
    ├─ Cloud SQL Proxy ──► [Cloud SQL]
    │
    └─ ──► [GCS]
```

---

## 12. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-02-13 | 1.0 | 初版作成。画面仕様6画面、API仕様（診断・AI推論・履歴・ラベリング）、データモデル3テーブル、判定エンジン共通インターフェース、アドバイス生成ロジック、エラーハンドリング、セキュリティ、Docker Compose仕様、GCPインフラ構成を定義 |

---

*Generated by CCAGI SDK v3.5.0 - Phase 2: Design (CMD-002)*

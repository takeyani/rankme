# ccagi

CCAGI SDKプロジェクト。設定は `.ccagi.yml` を参照。

---

## 開発ルール

### Issue-First原則

> "Everything starts with an Issue. Labels define the state."

開発作業（Phase 4以降）を開始する前に、必ずGitHub Issueを起票または参照すること。

| 作業種別 | Issue要件 |
|---------|----------|
| 単純変更（1ファイル、設定変更、typo修正） | 推奨（省略可） |
| 通常変更（複数ファイル） | Issue必須 |
| 複合タスク（3ステップ以上） | Epic Issue必須 + Phase/Wave/Cycle分解 |

**手順**:
1. `gh issue list` で既存Issueを確認
2. 該当Issueがなければ `/create-issue` または `gh issue create` で起票
3. ブランチ名にIssue番号を含める: `fix/123-description`
4. コミットメッセージにIssue参照: `fix(scope): description (#123)`
5. PRに `Resolves #123` を記載

**違反した場合**: 事後でもIssueを起票し対応記録を残すこと。

### Agent Pipeline誘導

ソースコード（`src/`, `packages/`）を変更する場合、Write/Editツールで直接書かず、Agent Pipeline経由を推奨。

| 変更対象 | 推奨フロー |
|---------|----------|
| ソースコード（複合タスク） | CoordinatorAgent → CodeGenAgent |
| ソースコード（単純変更） | CodeGenAgent |
| 設定・ドキュメント（.yml, .json, .md, .sh, docs/） | 直接Edit |

**Agent起動方法**: `agent_run(name: "coordinator")` または `/agent-run`

### Subagent並列度制限

`.ccagi.yml` の `coordinator_agent.max_parallel_tasks: 3` に従い、Task toolの同時並列起動は**最大3**。

- 4以上の独立タスクがある場合はバッチ分割すること
- コンテキストオーバー防止のため厳守

---

## 自然言語コマンドガイド

**あなたの意図を自然言語で伝えてください。** 適切なスキル/コマンド/エージェントを自動選択します。

### 意図→リソースマッピング（主要50パターン）

| やりたいこと | リソース | 種別 |
|-------------|---------|------|
| テストして、テスト実行、ユニットテスト | `/test` | スキル |
| コードレビュー、レビューして、品質チェック | `/review-execute` | コマンド |
| セキュリティ監査、脆弱性チェック、セキュリティスキャン | `/security-audit` | スキル |
| デプロイ、本番反映、AWSデプロイ | `/aws-fast-deploy` | スキル |
| 開発環境にデプロイ、devデプロイ | `/deploy-dev` | コマンド |
| 本番環境にデプロイ、prodデプロイ | `/deploy-prod` | コマンド |
| 要件定義、要件作成、要件を生成 | `/generate-requirements` | コマンド |
| 仕様書作成、スペック作成 | `/spec-create` | コマンド |
| Issue分析、ラベル付け、Issue整理 | IssueAgent | エージェント |
| コード生成、実装して、コードを書いて | CodeGenAgent | エージェント |
| PR作成、プルリクエスト作成 | `/pr-create` | コマンド |
| ドキュメント生成、ドキュメント作成 | `/generate-docs` | コマンド |
| モック検出、ダミーデータ検出 | `/mock-detector` | スキル |
| TDD、テスト駆動開発 | `/tdd-workflow` | スキル |
| Git操作、コミット、プッシュ | `/git-workflow` | スキル |
| 依存関係更新、パッケージ更新 | `/deps-update` | コマンド |
| 依存関係監査、セキュリティ監査 | `/deps-audit` | コマンド |
| ビルドエラー修正、型エラー修正 | `/fix-build-errors` | コマンド |
| 型チェック、TypeScriptチェック | `/type-check` | コマンド |
| リント修正、ESLint修正 | `/lint-fix` | コマンド |
| リファクタリング、コード整理 | `/refactor` | コマンド |
| パフォーマンス分析、速度計測 | `/performance-analyze` | コマンド |
| ベンチマーク実行 | `/benchmark` | コマンド |
| ヘルスチェック、システム確認 | `/health-check` | コマンド |
| 環境確認、環境チェック | `/env-check` | コマンド |
| ログ確認、ログ表示 | `/logs` | コマンド |
| デプロイ状況、デプロイ確認 | `/deploy-status` | コマンド |
| ロールバック、巻き戻し | `/deploy-rollback` | コマンド |
| API生成、エンドポイント作成 | `/api-generate` | コマンド |
| コンポーネント作成 | `/component-create` | コマンド |
| サービス作成 | `/service-create` | コマンド |
| マイグレーション作成 | `/migration-create` | コマンド |
| マイグレーション実行 | `/migration-run` | コマンド |
| ADR作成、設計記録 | `/adr-create` | コマンド |
| シーケンス図生成 | `/generate-sequence-diagram` | コマンド |
| アーキテクチャ図生成 | `/generate-architecture-diagram` | コマンド |
| データフロー図生成 | `/generate-dataflow-diagram` | コマンド |
| デザインシステム作成 | `/design-system` | コマンド |
| フロントエンドデザイン | `/frontend-design` | コマンド |
| レスポンシブデザイン | `/responsive-design` | コマンド |
| UI品質チェック | `/ui-skills` | コマンド |
| UXレビュー | `/ux-review` | コマンド |
| 全自動モード、自律実行 | `/ccagi-auto` | コマンド |
| Agent実行、エージェント実行 | `/agent-run` | コマンド |
| Worktree作成、作業ブランチ作成 | `/worktree-create` | コマンド |
| Worktree一覧 | `/worktree-list` | コマンド |
| RAG検索、メモリ検索 | `/rag-search` | コマンド |
| RAG保存、メモリ保存 | `/rag-save` | コマンド |
| フィードバック記録 | `/user-feedback` | コマンド |
| SSOT Issue作成 | `/create-ssot-issue` | コマンド |

---

## スキル全量リスト（33スキル）

| カテゴリ | スキル名 | トリガーフレーズ | 説明 |
|---------|---------|----------------|------|
| **品質** | `/quality-gateway-engine` | 品質ゲート、品質検証 | 統合品質検証エンジン |
| **品質** | `/mock-detector` | モック検出、ダミー検出 | モック・仮実装検出 |
| **品質** | `/security-audit` | セキュリティ監査 | 脆弱性・セキュリティ検証 |
| **品質** | `/security-scanner` | セキュリティスキャン | Prowler/ZAPスキャン |
| **開発** | `/tdd-workflow` | TDD、テスト駆動 | Red-Green-Refactorサイクル |
| **開発** | `/git-workflow` | Git操作、コミット | Git自動化 |
| **開発** | `/project-setup` | プロジェクト初期化 | プロジェクトセットアップ |
| **開発** | `/dependency-management` | 依存関係管理 | パッケージ管理 |
| **開発** | `/rust-development` | Rust開発 | Rustワークフロー |
| **開発** | `/debugging-troubleshooting` | デバッグ、トラブルシュート | エラー診断 |
| **開発** | `/performance-analysis` | パフォーマンス分析 | CPU/メモリ分析 |
| **開発** | `/documentation-generation` | ドキュメント生成 | ドキュメント自動生成 |
| **テスト** | `/docker-test-loop` | Dockerテスト | Docker環境テストループ |
| **テスト** | `/sdk-release-test` | SDKリリーステスト | リリース後全機能テスト |
| **自動化** | `/agent-execution` | Agent実行 | エージェント自律実行 |
| **自動化** | `/agent-generator` | Agent生成 | エージェント動的生成 |
| **自動化** | `/intelligent-task-planner` | タスク計画 | DAG分解・計画 |
| **自動化** | `/dag-decomposer` | DAG分解 | タスク分解 |
| **自動化** | `/agile-automation-framework` | アジャイル自動化 | 統合自動化 |
| **自動化** | `/feedback-auto-detect` | フィードバック検出 | 要望自動検出 |
| **自動化** | `/user-feedback` | ユーザーフィードバック | フィードバック記録 |
| **デザイン** | `/frontend-design-suite` | フロントエンドデザイン | UI/UX設計統合 |
| **デザイン** | `/human-centered-design-suite` | UX分析 | カスタマージャーニー分析 |
| **デザイン** | `/design-reviewer` | デザインレビュー | UIデザインレビュー |
| **デザイン** | `/customer-journey-mapping` | カスタマージャーニー | ジャーニーマップ |
| **デザイン** | `/ui-friction-detection` | UI摩擦検出 | ユーザビリティ問題検出 |
| **デザイン** | `/user-affect-analysis` | 感情分析 | PADモデル分析 |
| **コンテンツ** | `/smart-content-engine` | コンテンツ生成 | 知的コンテンツ生成 |
| **コンテンツ** | `/seo-generator` | SEO生成 | SEO自動生成 |
| **データ** | `/data-supply-server` | テストデータ生成 | データ供給サーバー |
| **データ** | `/ssot-docs-sync` | SSOT同期 | ドキュメント同期 |
| **DevOps** | `/aws-fast-deploy` | AWSデプロイ | 高速AWSデプロイ |
| **DevOps** | `/pipeline-validator` | パイプライン検証 | CodePipeline検証 |
| **DevOps** | `/npm-package-publish` | npm公開 | パッケージ公開 |
| **DevOps** | `/development-operations-toolkit` | DevOps統合 | 開発運用ツールキット |
| **ワークフロー** | `/context-eng` | コンテキスト抽出 | 自律コンテキスト抽出 |
| **ワークフロー** | `/issue-analysis` | Issue分析 | Issue自動分析 |
| **SDK** | `/sdk-publish` | SDKリリース | S3アップロード |

---

## コマンド全量リスト（96コマンド）

### Phase 1: 要件定義

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/generate-requirements` | 要件定義、要件作成 | 要件自動生成 |
| `/add-requirements` | 要件追加 | 追加要件を追記 |

### Phase 2: 設計

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/spec-create` | 仕様書作成、スペック作成 | 機能仕様書作成 |
| `/design-system` | デザインシステム | デザインシステム生成 |
| `/frontend-design` | フロントエンドデザイン | UI設計方針策定 |
| `/canvas-design` | ビジュアルアート | ビジュアルコンセプト作成 |
| `/generate-sequence-diagram` | シーケンス図 | シーケンス図生成 |
| `/generate-architecture-diagram` | アーキテクチャ図 | アーキテクチャ図生成 |
| `/generate-dataflow-diagram` | データフロー図 | データフロー図生成 |
| `/generate-test-design` | テスト設計 | テスト設計書生成 |

### Phase 3: 計画

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/create-ssot-issue` | SSOT Issue作成 | SSOT Issue作成 |
| `/ux-review` | UXレビュー | UX分析実行 |
| `/plan-project` | プロジェクト計画 | スケジュール生成 |
| `/optimize-resources` | リソース最適化 | Agent最適化 |

### Phase 4: 実装

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/implement-app` | 実装、アプリ実装 | アプリケーション実装 |
| `/codegen-execute` | コード生成 | CodeGenAgent実行 |
| `/optimize-design` | デザイン最適化 | UI/UX最適化 |
| `/ui-styling` | UIスタイリング | shadcn/ui実装 |
| `/responsive-design` | レスポンシブ | レスポンシブ実装 |
| `/api-generate` | API生成 | エンドポイント生成 |
| `/component-create` | コンポーネント作成 | UIコンポーネント作成 |
| `/service-create` | サービス作成 | サービス層作成 |
| `/migration-create` | マイグレーション作成 | DBマイグレーション作成 |
| `/migration-run` | マイグレーション実行 | マイグレーション実行 |
| `/fix-build-errors` | ビルドエラー修正 | TypeScriptエラー修正 |
| `/refactor` | リファクタリング | コード整理 |

### Phase 5: テスト

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/test` | テスト、テスト実行 | 統合テスト実行 |
| `/type-check` | 型チェック | TypeScriptチェック |
| `/lint-fix` | リント修正 | ESLint修正 |
| `/benchmark` | ベンチマーク | 性能測定 |
| `/performance-analyze` | パフォーマンス分析 | 速度分析 |

### Phase 5.5: 品質ゲート

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/mock-detector` | モック検出 | ダミーデータ検出 |
| `/ui-skills` | UI品質チェック | UI品質レビュー |
| `/quality-score` | 品質スコア | 品質数値化 |
| `/review-execute` | コードレビュー | ReviewAgent実行 |
| `/security-scan` | セキュリティスキャン | 脆弱性スキャン |
| `/deps-audit` | 依存関係監査 | セキュリティ監査 |
| `/gap-analyze` | ギャップ分析 | 要件差分検出 |

### Phase 6: ドキュメント

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/generate-docs` | ドキュメント生成 | ドキュメント自動生成 |
| `/docs-generate` | ドキュメント作成 | ドキュメント生成 |
| `/generate-user-manual` | ユーザーマニュアル | マニュアル生成 |
| `/generate-demo-scenario` | デモシナリオ | デモ用シナリオ生成 |
| `/generate-test-accounts` | テストアカウント | テスト用アカウント生成 |
| `/generate-test-fixtures` | テストフィクスチャ | テストデータ生成 |
| `/adr-create` | ADR作成 | 設計決定記録 |

### Phase 7: デプロイ

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/deploy` | デプロイ | 統合デプロイ |
| `/deploy-dev` | 開発デプロイ | 開発環境デプロイ |
| `/deploy-prod` | 本番デプロイ | 本番環境デプロイ |
| `/deploy-execute` | デプロイ実行 | CodePipelineトリガー |
| `/deploy-status` | デプロイ状況 | 状態確認 |
| `/deploy-rollback` | ロールバック | 巻き戻し |
| `/aws-fast-deploy` | AWSデプロイ | 高速AWSデプロイ |
| `/verify-app` | アプリ検証 | プリデプロイ検証 |
| `/run-predeploy-verification` | プリデプロイ検証 | 全チェック一括実行 |
| `/setup-pipeline` | パイプライン設定 | CodePipelineセットアップ |
| `/setup-infrastructure` | インフラ構築 | AWS環境構築 |
| `/environment-diff-check` | 環境差分確認 | ローカルvsAWS差分 |

### 運用・管理

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/health-check` | ヘルスチェック | システム健全性確認 |
| `/verify` | システム確認 | 環境・コンパイル・テスト全チェック |
| `/env-check` | 環境確認 | 環境チェック |
| `/env-setup` | 環境セットアップ | 環境構築 |
| `/logs` | ログ確認 | ログ表示 |
| `/agent-run` | Agent実行 | エージェント自律実行 |
| `/agent-status` | Agent状態 | エージェント状態確認 |
| `/ccagi-auto` | 全自動モード | 自律実行開始 |
| `/tmux-control` | tmux制御 | tmuxセッション管理 |
| `/incident-report` | インシデント報告 | インシデントレポート作成 |
| `/monitoring-setup` | モニタリング設定 | 監視設定 |

### Git・PR・Issue

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/pr-create` | PR作成 | プルリクエスト作成 |
| `/pr-list` | PR一覧 | PR状態確認 |
| `/ai-code-review` | AIレビュー | AI支援コードレビュー |
| `/create-issue` | Issue作成 | GitHub Issue作成 |
| `/ccagi-todos` | TODO検出 | TODOコメントIssue化 |
| `/git-sync` | Git同期 | Git同期 |
| `/git-clean` | Gitクリーン | クリーンアップ |
| `/worktree-create` | Worktree作成 | 作業ブランチ作成 |
| `/worktree-list` | Worktree一覧 | Worktree確認 |
| `/worktree-cleanup` | Worktree削除 | クリーンアップ |

### その他

| コマンド | トリガーフレーズ | 説明 |
|---------|----------------|------|
| `/rag-search` | RAG検索 | メモリ検索 |
| `/rag-save` | RAG保存 | メモリ保存 |
| `/user-feedback` | フィードバック | フィードバック記録 |
| `/feedback-auto-detect` | フィードバック検出 | 要望自動検出 |
| `/sync-feedback` | フィードバック同期 | SSOT同期 |
| `/confirm-feature` | 機能確認 | ステータス更新 |
| `/session-end` | セッション終了 | 終了通知 |
| `/deps-update` | 依存関係更新 | パッケージ更新 |
| `/docker-build` | Dockerビルド | イメージビルド |
| `/cache-clear` | キャッシュクリア | キャッシュ削除 |
| `/db-backup` | DBバックアップ | データベースバックアップ |
| `/ssh-connect` | SSH接続 | リモート接続 |
| `/aws-status` | AWS状態 | AWS Organization確認 |
| `/release-prepare` | リリース準備 | リリース準備 |
| `/release-publish` | リリース公開 | リリース公開 |
| `/sdk-publish` | SDK公開 | S3アップロード |
| `/sdk-release-test` | SDKリリーステスト | 全機能テスト |
| `/npm-publisher` | npm公開 | パッケージ公開 |
| `/generate-app` | アプリ生成 | 全Phase一括実行 |

---

## エージェント全量リスト（31体）

### コアエージェント（6体）

| エージェント | キャラクター | トリガーフレーズ | 役割 |
|-------------|------------|----------------|------|
| CoordinatorAgent | 統（Subaru） | タスク統括、全体管理 | タスク分解・DAG構築 |
| CodeGenAgent | 源（Gen） | コード生成、実装して | AI駆動コード生成 |
| ReviewAgent | 剣持謙二（Kenji） | レビュー、品質チェック | コード品質レビュー |
| IssueAgent | 析（Seki） | Issue分析、ラベル付け | Issue分析・ラベル管理 |
| PRAgent | 繋（Kei） | PR作成 | PR自動作成 |
| DeploymentAgent | 航（Wataru） | デプロイ | CI/CD自動化 |

### 開発エージェント（5体）

| エージェント | トリガーフレーズ | 役割 |
|-------------|----------------|------|
| FrontendAgent | フロントエンド開発 | UI/UX実装 |
| BackendAgent | バックエンド開発 | サーバーサイド実装 |
| APIAgent | API開発 | RESTful/GraphQL設計 |
| DatabaseAgent | データベース設計 | スキーマ設計・最適化 |
| ArchitectureAgent | アーキテクチャ設計 | システム設計 |

### 運用エージェント（5体）

| エージェント | トリガーフレーズ | 役割 |
|-------------|----------------|------|
| DevOpsAgent | DevOps、CI/CD | インフラ自動化 |
| MonitoringAgent | 監視、モニタリング | メトリクス・アラート |
| IncidentAgent | インシデント対応 | 障害対応・ポストモーテム |
| DeployInfraAgent | インフラデプロイ | 共有インフラ構築 |
| AWSAgent | AWS管理 | AWS環境構築・最適化 |

### 品質エージェント（6体）

| エージェント | トリガーフレーズ | 役割 |
|-------------|----------------|------|
| QAAgent | 品質保証、QA | テスト戦略・品質保証 |
| TestAgent | テスト | テスト自動化 |
| SecurityAgent | セキュリティ | セキュリティ監査 |
| PerformanceAgent | パフォーマンス | 性能最適化 |
| RefactorAgent | リファクタリング | コード品質改善 |
| OptimizationAgent | 最適化 | 全体最適化 |

### 自動化エージェント（4体）

| エージェント | キャラクター | トリガーフレーズ | 役割 |
|-------------|------------|----------------|------|
| BrowserAutomationAgent | 瀬良（Seira） | ブラウザ操作 | Playwright自動化 |
| TmuxControlAgent | 紬（Tsumugi） | tmux制御 | マルチセッション管理 |
| BatchIssueAgent | 量（Ryo） | Issue一括作成 | バッチIssue作成 |
| RefresherAgent | 鮮（Sen） | 状態更新 | 状態監視・更新 |

### ドキュメントエージェント（4体）

| エージェント | トリガーフレーズ | 役割 |
|-------------|----------------|------|
| DocumentationAgent | ドキュメント作成 | ドキュメント自動生成 |
| UXReviewAgent | UXレビュー | UX分析・改善提案 |
| AIProductAnalyzerAgent | プロダクト分析 | AI製品分析 |
| MigrationAgent | マイグレーション | 移行管理 |

### 特殊エージェント（1体）

| エージェント | トリガーフレーズ | 役割 |
|-------------|----------------|------|
| LicenseManagementAgent | ライセンス管理 | ライセンス検証・管理 |
| RustMigrationAgent | Rust移行 | TypeScript→Rust移行 |

---

## SDK Phase別ワークフロー

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 5.5 → Phase 6 → Phase 7
要件定義    設計      計画      実装     テスト    品質ゲート  ドキュメント  デプロイ
```

| Phase | 名称 | 主要コマンド |
|-------|------|-------------|
| 1 | 要件定義 | `/generate-requirements` |
| 2 | 設計 | `/spec-create`, `/design-system` |
| 3 | 計画 | `/create-ssot-issue`, `/ux-review` |
| 4 | 実装 | `/implement-app` |
| 5 | テスト | `/test` |
| 5.5 | 品質ゲート | `/mock-detector`, `/ui-skills` |
| 6 | ドキュメント | `/generate-docs` |
| 7 | デプロイ | `/deploy-dev`, `/deploy-prod` |

---

## CCAGI Label System（60ラベル）

GitHub Issueの自動分類・管理に使用するラベル体系。

| カテゴリ | ラベル形式 | 用途 |
|---------|-----------|------|
| STATE (8) | `state:pending`, `state:implementing`, `state:done` | ライフサイクル管理 |
| AGENT (6) | `agent:codegen`, `agent:review`, `agent:issue` | Agent割り当て |
| PRIORITY (4) | `priority:P0-Critical`〜`priority:P3-Low` | 優先度管理 |
| TYPE (7) | `type:feature`, `type:bug`, `type:refactor` | Issue分類 |
| SEVERITY (4) | `severity:Sev.1-Critical`〜`severity:Sev.4-Low` | 深刻度 |
| PHASE (8) | `phase:1-requirements`〜`phase:7-deployment` | SDKフェーズ |
| HIERARCHY (4) | `hierarchy:root`, `hierarchy:parent`, `hierarchy:child` | Issue階層 |

**詳細**: `docs/LABEL_SYSTEM_GUIDE.md`

**セットアップ**: `ccagi-sdk init` でリポジトリに60ラベルを自動設定

---

## MCP呼び出し

| リソース | MCPツール |
|---------|----------|
| コマンド | `skill_execute(name: "コマンド名")` |
| エージェント | `agent_run(name: "エージェント名")` |
| スキル | `skill_execute(name: "スキル名")` |
| 一覧取得 | `skill_list`, `agent_list`, `command_list` |

### スキル呼び出しの仕組み

```
ユーザー: /test --mode e2e
  ↓
Claude Code: Skill ツールを使用
  ↓
MCPサーバー (ccagi-tools-server): skill_execute("test") を処理・実行
```

**補足**: スキルはMCPサーバー内蔵。`.claude/skills/` と `.claude/commands/` はドキュメント用。

---

## RAGメモリ

- **開始時**: `/rag-search` で関連情報を検索
- **終了時**: `/rag-save` で学んだ情報を保存

---

## SDK CLI

```bash
ccagi-sdk status      # 状態確認
ccagi-sdk init        # プロジェクト初期化
ccagi-sdk activate    # ライセンス有効化
ccagi-sdk setup-claude # Claude Code連携
```

---

## フィードバック

- `/user-feedback <内容>` - 記録
- `/sync-feedback` - 同期・適用

---
Powered by CCAGI SDK v3.5.0

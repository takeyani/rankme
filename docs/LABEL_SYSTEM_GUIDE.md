# CCAGI Label System - 完全ガイド

**自律型開発フレームワークの心臓部 - 60ラベル体系の完全理解**

---

## 目次

1. [Label Systemとは](#label-systemとは)
2. [タスク分解フレームワーク](#タスク分解フレームワーク)
3. [マイルストーン設定ルール](#マイルストーン設定ルール)
4. [AS-IS → TO-BE 確認プロセス](#as-is--to-be-確認プロセス)
5. [11のカテゴリ概要](#11のカテゴリ概要)
6. [詳細解説](#詳細解説)
7. [実践ガイド](#実践ガイド)
8. [自動化との連携](#自動化との連携)

---

## Label Systemとは

### 基本思想

```
"Everything starts with an Issue. Labels define the state."
```

CCAGIでは、**Labelがオペレーティングシステムの状態管理機構**として機能します。
全ての自動化はLabelを確認してIssue/PRの状態を判断し、適切なアクションを実行します。

### 状態遷移フロー

```
📥 pending → 🔍 analyzing → 🏗️ implementing → 👀 reviewing → ✅ done
```

このフローを中心に、60個のLabelが以下の11カテゴリに分類されています。

---

## タスク分解フレームワーク

### Phase / Waves / Cycles 階層構造

すべてのEpic Issueは以下の階層構造でタスクを分解します：

```
Epic Issue (hierarchy:root)
    │
    ├── Phase A (hierarchy:parent) ─ 大きな機能単位
    │       │
    │       ├── Wave A1 ─ 実行可能な作業単位
    │       │     ├── Cycle A1.1 ─ 最小タスク
    │       │     ├── Cycle A1.2
    │       │     └── Cycle A1.3
    │       │
    │       └── Wave A2
    │             ├── Cycle A2.1
    │             └── Cycle A2.2
    │
    ├── Phase B (hierarchy:parent)
    │       └── ...
    │
    └── Phase C (hierarchy:leaf) ─ 検証・完了
```

### 分解の原則

| レベル | 粒度 | 目的 | 例 |
|--------|------|------|-----|
| **Epic** | 1-4週間 | 大きな目標・機能 | Label System最適化 |
| **Phase** | 2-5日 | 機能単位の分割 | ラベル定義、IssueAgent拡張 |
| **Wave** | 半日-1日 | 実行可能な作業単位 | ロジック実装、テスト追加 |
| **Cycle** | 1-4時間 | 最小タスク | キーワードマッピング定義 |

### 複雑度分類

| 複雑度 | 目安時間 | 変更規模 | 例 |
|--------|---------|---------|-----|
| **S (Small)** | 1-2時間 | 単一ファイル | 設定変更、ドキュメント追記 |
| **M (Medium)** | 半日〜1日 | 複数ファイル | 新機能追加、テスト追加 |
| **L (Large)** | 2-3日 | アーキテクチャ変更 | リファクタリング、API変更 |
| **XL (Extra Large)** | 1週間以上 | 複数コンポーネント | 大規模移行、新システム構築 |

### 依存関係の明示

```yaml
# Issue本文での依存関係記述
## 依存関係
- blockedBy: #93, #94  # この Issue が待機する Issue
- blocks: #96          # この Issue の完了を待つ Issue
```

---

## マイルストーン設定ルール

### 必須ルール

すべてのEpic Issueは以下を満たすこと：

| ルール | 説明 |
|--------|------|
| マイルストーン必須 | Epic Issue作成時に必ずマイルストーンを設定 |
| 期限設定 | `due_on` を明示（2週間〜1ヶ月が目安） |
| 子Issue紐づけ | すべての子Issueは同じマイルストーンに紐づけ |
| 進捗追跡 | open/closed Issue数で進捗を可視化 |

### マイルストーン命名規則

```
M{N}: {目的}
例: M6: Label System Optimization

Phase {N}: {目的}
例: Phase 1: LMC基盤構築

L{N}: {目的}
例: L0: LMC基盤構築
```

### マイルストーン作成コマンド

```bash
# マイルストーン作成
gh api repos/:owner/:repo/milestones -f title="M6: Label System Optimization" -f due_on="2026-02-13T00:00:00Z"

# Issue にマイルストーン設定
gh issue edit 92 --milestone "M6: Label System Optimization"
```

---

## AS-IS → TO-BE 確認プロセス

### Epic Issue作成時の必須プロセス

すべてのEpic Issueは、作成時に以下のチェックリストを完了すること：

```markdown
## AS-IS → TO-BE 確認チェックリスト

- [ ] AS-IS（現状）を文書化
- [ ] TO-BE（理想状態）を定義
- [ ] ギャップ分析を実施
- [ ] 必要タスクを Phase/Waves/Cycles に分解
- [ ] 各タスクをIssueとして起票
- [ ] 依存関係（blockedBy/blocks）を設定
- [ ] マイルストーンを設定
- [ ] 漸次実行でTO-BE到達可能か検証
```

### ギャップ分析テンプレート

```markdown
## AS-IS（現状）

| 項目 | 状態 | 詳細 |
|------|------|------|
| 機能A | ⚠️ 部分実装 | 基本機能のみ |
| 機能B | ❌ 未実装 | - |
| 機能C | ✅ 完了 | - |

## TO-BE（理想状態）

| 項目 | 目標 | 詳細 |
|------|------|------|
| 機能A | 完全実装 | 拡張機能含む |
| 機能B | 完全実装 | 新規追加 |
| 機能C | 維持 | 変更なし |

## ギャップ分析

| 項目 | AS-IS | TO-BE | ギャップ | 対応Phase |
|------|-------|-------|---------|----------|
| 機能A | 部分 | 完全 | 拡張必要 | Phase B |
| 機能B | なし | 完全 | 新規実装 | Phase C |
```

### 漸次実行の検証

TO-BEに到達可能かを検証するため、以下を確認：

1. **依存関係の整合性**: 循環依存がないこと
2. **完全性**: すべてのギャップに対応するタスクがあること
3. **実行可能性**: 各タスクが実行可能なサイズであること
4. **測定可能性**: 完了条件が明確であること

---

## 11のカテゴリ概要

| # | カテゴリ | 数 | 役割 | 例 |
|---|---------|---|------|-----|
| 1 | **STATE** | 8 | ライフサイクル管理 | `📥 state:pending`, `✅ state:done` |
| 2 | **AGENT** | 6 | Agent割り当て | `🤖 agent:coordinator`, `🤖 agent:codegen` |
| 3 | **PRIORITY** | 4 | 優先度管理 | `🔥 priority:P0-Critical`, `📝 priority:P3-Low` |
| 4 | **TYPE** | 7 | Issue分類 | `✨ type:feature`, `🐛 type:bug` |
| 5 | **SEVERITY** | 4 | 深刻度・エスカレーション | `🚨 severity:Sev.1-Critical` |
| 6 | **PHASE** | 8 | CCAGI SDKフェーズ | `📋 phase:1-requirements`, `🚀 phase:7-deployment` |
| 7 | **SPECIAL** | 7 | 特殊操作 | `🔐 security`, `💰 cost-watch` |
| 8 | **TRIGGER** | 4 | 自動化トリガー | `🤖 trigger:agent-execute` |
| 9 | **QUALITY** | 4 | 品質スコア | `⭐ quality:excellent`, `🔴 quality:poor` |
| 10 | **COMMUNITY** | 4 | コミュニティ | `👋 good-first-issue`, `🙏 help-wanted` |
| 11 | **HIERARCHY** | 4 | Issue階層 | `🌳 hierarchy:root`, `🍃 hierarchy:leaf` |

**合計: 60ラベル**

---

## 詳細解説

### 1. STATE Labels (8個) - ライフサイクル管理

Issueの現在の状態を表す**最重要ラベル**。必ず1つ付与される。

| ラベル | 色 | 意味 | 次の状態 |
|--------|-----|------|---------|
| `📥 state:pending` | グレー | トリアージ待ち | analyzing |
| `🔍 state:analyzing` | グリーン | 分析中 | implementing |
| `🏗️ state:implementing` | ブルー | 実装中 | reviewing |
| `👀 state:reviewing` | イエロー | レビュー中 | done |
| `✅ state:done` | グリーン | 完了 | - |
| `🔴 state:blocked` | レッド | ブロック中 | analyzing |
| `🛑 state:failed` | ダークレッド | 失敗 | analyzing |
| `⏸️ state:paused` | パープル | 一時停止 | 任意 |

### 2. AGENT Labels (6個) - Agent割り当て

| ラベル | 担当Agent | 役割 |
|--------|-----------|------|
| `🤖 agent:coordinator` | CoordinatorAgent (統) | タスク統括、DAG分解 |
| `🤖 agent:codegen` | CodeGenAgent (源) | コード生成 |
| `🤖 agent:review` | ReviewAgent (謙二) | 品質チェック |
| `🤖 agent:issue` | IssueAgent (析) | Issue分析・ラベル管理 |
| `🤖 agent:pr` | PRAgent (繋) | PR自動作成 |
| `🤖 agent:deployment` | DeploymentAgent (航) | デプロイ自動化 |

### 3. PRIORITY Labels (4個) - 優先度管理

| ラベル | SLA | 例 |
|--------|-----|-----|
| `🔥 priority:P0-Critical` | 24時間以内 | セキュリティ、本番障害 |
| `⚠️ priority:P1-High` | 3日以内 | 主要機能、重大バグ |
| `📊 priority:P2-Medium` | 1週間以内 | 標準機能、通常バグ |
| `📝 priority:P3-Low` | 特になし | Nice-to-have |

### 4. TYPE Labels (7個) - Issue分類

| ラベル | 意味 |
|--------|------|
| `✨ type:feature` | 新機能追加 |
| `🐛 type:bug` | バグ修正 |
| `📚 type:docs` | ドキュメント |
| `🔧 type:refactor` | リファクタリング |
| `🧪 type:test` | テスト追加 |
| `🏗️ type:architecture` | アーキテクチャ変更 |
| `🚀 type:deployment` | デプロイ・インフラ |

### 5. SEVERITY Labels (4個) - 深刻度

| ラベル | エスカレーション |
|--------|-----------------|
| `🚨 severity:Sev.1-Critical` | Guardian + CISO + TechLead |
| `⚠️ severity:Sev.2-High` | TechLead or CISO |
| `📊 severity:Sev.3-Medium` | なし（自動処理） |
| `📝 severity:Sev.4-Low` | なし |

### 6. PHASE Labels (8個) - CCAGI SDKフェーズ

| ラベル | CCAGI Phase | 主要コマンド |
|--------|-------------|-------------|
| `📋 phase:1-requirements` | 要件定義 | `/generate-requirements` |
| `🎨 phase:2-design` | 設計 | `/spec-create`, `/design-system` |
| `🗓️ phase:3-planning` | 計画 | `/create-ssot-issue` |
| `💻 phase:4-implementation` | 実装 | `/implement-app` |
| `🧪 phase:5-testing` | テスト | `/test` |
| `✅ phase:5.5-quality-gate` | 品質ゲート | `/mock-detector`, `/ui-skills` |
| `📖 phase:6-documentation` | ドキュメント | `/generate-docs` |
| `🚀 phase:7-deployment` | デプロイ | `/deploy-dev`, `/deploy-prod` |

### 7. SPECIAL Labels (7個) - 特殊操作

| ラベル | 意味 | 処理 |
|--------|------|------|
| `🔐 security` | セキュリティ関連 | CISO通知、非公開推奨 |
| `💰 cost-watch` | 高コスト操作 | 予算監視 |
| `🔄 dependencies` | 依存関係あり | 依存解決待ち |
| `🎓 learning` | 学習タスク | SLA緩和 |
| `🔬 experiment` | 実験的 | 失敗許容 |
| `🚫 wontfix` | 修正しない | クローズ |
| `🔁 duplicate` | 重複 | 元Issueリンク |

### 8. TRIGGER Labels (4個) - 自動化トリガー

| ラベル | トリガー内容 |
|--------|-------------|
| `🤖 trigger:agent-execute` | Autonomous Agent実行 |
| `📊 trigger:generate-report` | レポート生成 |
| `🚀 trigger:deploy-staging` | stagingデプロイ |
| `🚀 trigger:deploy-production` | productionデプロイ |

### 9. QUALITY Labels (4個) - 品質スコア

| ラベル | スコア | 基準 |
|--------|--------|------|
| `⭐ quality:excellent` | 90-100点 | カバレッジ90%+、セキュリティOK |
| `✅ quality:good` | 80-89点 | カバレッジ80%+、警告のみ |
| `⚠️ quality:needs-improvement` | 60-79点 | 改善提案あり |
| `🔴 quality:poor` | 0-59点 | 再実装要求 |

### 10. COMMUNITY Labels (4個) - コミュニティ

| ラベル | 意味 |
|--------|------|
| `👋 good-first-issue` | 初心者向け |
| `🙏 help-wanted` | 助けが必要 |
| `❓ question` | 質問・相談 |
| `💬 discussion` | ディスカッション |

### 11. HIERARCHY Labels (4個) - Issue階層

| ラベル | 意味 | 用途 |
|--------|------|------|
| `🌳 hierarchy:root` | Epic Issue | 最上位、マイルストーン設定 |
| `📂 hierarchy:parent` | Phase Issue | 機能単位の分割 |
| `📄 hierarchy:child` | Wave/Cycle Issue | 実行可能なタスク |
| `🍃 hierarchy:leaf` | 最小タスク | 最終検証・完了 |

---

## 実践ガイド

### Issue作成時のLabel付与フロー

```yaml
タイトル: ダークモード機能の追加
Labels:
  - 📥 state:pending       # 自動付与
  - ✨ type:feature        # 手動付与
  - ⚠️ priority:P1-High   # 手動付与
  - 📋 phase:1-requirements # 自動推論
  - 🤖 agent:codegen       # 自動割り当て
```

### 最小3ラベルでOK

新しいIssueを作成したら、以下の3つは必須：

1. **STATE** (1つ): 自動付与される
2. **TYPE** (1つ): `type:feature`, `type:bug` など
3. **PRIORITY** (1つ): `priority:P0-Critical` など

---

## 自動化との連携

### IssueAgent による自動ラベル推論

IssueAgent（析）は以下を自動推論：

- **Type**: タイトル・本文のキーワードから
- **Phase**: コマンド・ワークフロー関連キーワードから
- **Severity**: 緊急度キーワードから
- **Agent**: タスク内容から担当Agentを割り当て

### ラベル同期コマンド

```bash
# ラベル定義をGitHubに同期
gh label import .github/labels.yml

# ラベル一覧確認
gh label list | wc -l  # → 60+
```

---

## 関連ドキュメント

- [CLAUDE.md](../../CLAUDE.md) - プロジェクトルートのコマンド一覧
- [.github/labels.yml](../../.github/labels.yml) - Label定義ファイル
- [phase-overview.md](./workflows/phase-overview.md) - CCAGI SDKフェーズ概要

---

**CCAGI Label System** - Beauty in Autonomous Development

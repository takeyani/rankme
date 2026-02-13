# RankMe セットアップガイド

RankMe プロジェクトの開発環境構築から本番デプロイまでの手順書です。

---

## 目次

1. [前提条件](#1-前提条件)
2. [ローカル開発](#2-ローカル開発)
3. [Docker環境](#3-docker環境)
4. [環境変数](#4-環境変数)
5. [データベース](#5-データベース)
6. [AI推論サービス](#6-ai推論サービス)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. 前提条件

### 必須ソフトウェア

| ソフトウェア | バージョン | 用途 |
|-------------|-----------|------|
| Node.js | 20 以上 | Next.js アプリケーション実行 |
| npm | 10 以上 (Node.js 20 同梱) | パッケージ管理 |
| Docker | 24 以上 | コンテナ環境 |
| Docker Compose | v2 以上 | マルチコンテナ管理 |
| Git | 最新推奨 | バージョン管理 |

### オプション（ローカル開発時）

| ソフトウェア | バージョン | 用途 |
|-------------|-----------|------|
| PostgreSQL | 16 | Docker を使わずにDBを直接起動する場合 |
| Python | 3.11 | AI サービスをDocker外で起動する場合 |
| NVIDIA GPU + CUDA | - | AI推論の高速化（CPU でも動作可能） |
| NVIDIA Container Toolkit | 最新 | Docker 環境で GPU を利用する場合 |

### バージョン確認

```bash
node -v          # v20.x.x 以上
npm -v           # 10.x.x 以上
docker -v        # Docker version 24.x 以上
docker compose version  # Docker Compose version v2.x 以上
```

---

## 2. ローカル開発

Docker を使わず、ホストマシン上で直接開発する手順です。

### 2.1 リポジトリのクローン

```bash
git clone <repository-url>
cd rankme
```

### 2.2 依存パッケージのインストール

```bash
npm install
```

### 2.3 環境変数の設定

```bash
cp .env.example .env
```

`.env` を開き、以下を環境に合わせて編集します。

```dotenv
# ローカルの PostgreSQL に接続する場合
DATABASE_URL="postgresql://rankme:rankme@localhost:5432/rankme"

# AI サービスをローカルで起動する場合
AI_SERVICE_URL="http://localhost:8000"

# 推論エンジン（デフォルト）
RANKME_ENGINE="similarity_v1"
```

### 2.4 データベースのセットアップ

PostgreSQL が起動していることを確認し、以下を実行します。

```bash
# Prisma Client の生成
npm run db:generate

# スキーマをデータベースに反映（開発用）
npm run db:push
```

> **補足**: `db:push` は開発環境向けのコマンドです。本番環境では `npx prisma migrate deploy` を使用してください。

### 2.5 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセスして動作を確認します。

### 2.6 AI サービスの起動（オプション）

AI 推論機能を使う場合は、別ターミナルで AI サービスを起動します。

```bash
cd ai
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

ヘルスチェック:

```bash
curl http://localhost:8000/health
```

### 2.7 その他の npm スクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（ホットリロード有効） |
| `npm run build` | 本番用ビルド |
| `npm run start` | 本番用サーバー起動 |
| `npm run lint` | ESLint によるコード検査 |
| `npm run type-check` | TypeScript 型チェック |
| `npm run db:generate` | Prisma Client 生成 |
| `npm run db:push` | スキーマをDBに反映（開発用） |
| `npm run db:studio` | Prisma Studio 起動（DB GUI） |

---

## 3. Docker環境

全サービスをコンテナで一括起動する手順です。

### 3.1 基本起動

```bash
# 全サービスをバックグラウンドで起動
docker compose up -d

# ログを確認
docker compose logs -f
```

### 3.2 サービス構成

| サービス | ポート | 説明 |
|---------|-------|------|
| `web` | 3000 | Next.js アプリケーション |
| `ai` | 8000 | FastAPI AI 推論サービス |
| `db` | 5432 | PostgreSQL 16 データベース |

### 3.3 GPU を利用する場合

NVIDIA GPU を Docker コンテナで使用するには、事前に NVIDIA Container Toolkit をインストールしてください。

```bash
# NVIDIA Container Toolkit のインストール（Ubuntu の場合）
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

`docker-compose.yml` 内の AI サービスには GPU リソース予約が設定されています。

```yaml
ai:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

> **GPU なしで起動する場合**: `docker-compose.yml` の `deploy.resources.reservations.devices` セクションをコメントアウトしてください。AI サービスは CPU フォールバックで動作します。

### 3.4 個別サービスの操作

```bash
# 特定サービスのみ起動
docker compose up -d db        # DB のみ
docker compose up -d db ai     # DB + AI サービス

# 特定サービスの再ビルド
docker compose build web
docker compose build ai

# 特定サービスのログ確認
docker compose logs -f web
docker compose logs -f ai

# 全サービス停止
docker compose down

# ボリューム含めて完全削除
docker compose down -v
```

### 3.5 Docker イメージの詳細

**Web (Next.js)**

- ベースイメージ: `node:20-alpine`
- マルチステージビルド採用（ビルドサイズ最適化）
- ポート: 3000

**AI (FastAPI)**

- ベースイメージ: `python:3.11-slim`
- 主要ライブラリ: FastAPI, PyTorch, Pillow, numpy
- ポート: 8000

---

## 4. 環境変数

### 変数一覧

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `DATABASE_URL` | Yes | - | PostgreSQL 接続文字列 |
| `AI_SERVICE_URL` | Yes | - | AI 推論サービスの URL |
| `RANKME_ENGINE` | No | `similarity_v1` | 使用する推論エンジン名 |

### 環境別の設定例

**Docker 環境**

```dotenv
DATABASE_URL="postgresql://rankme:rankme@db:5432/rankme"
AI_SERVICE_URL="http://ai:8000"
RANKME_ENGINE="similarity_v1"
```

> Docker Compose のネットワーク内ではサービス名（`db`, `ai`）でホスト名を解決します。

**ローカル開発環境**

```dotenv
DATABASE_URL="postgresql://rankme:rankme@localhost:5432/rankme"
AI_SERVICE_URL="http://localhost:8000"
RANKME_ENGINE="similarity_v1"
```

**外部データベース使用時**

```dotenv
DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require"
AI_SERVICE_URL="http://localhost:8000"
RANKME_ENGINE="similarity_v1"
```

### 注意事項

- `.env` ファイルはリポジトリにコミットしないでください（`.gitignore` に追加済み）。
- Docker Compose 環境では、`docker-compose.yml` 内で環境変数を定義しているため、`.env` の設定が上書きされる場合があります。
- `DATABASE_URL` の接続先ホスト名は、Docker 内からは `db`、ホストマシンからは `localhost` を使用してください。

---

## 5. データベース

### 5.1 スキーマ概要

Prisma スキーマ（`prisma/schema.prisma`）で定義されている主要モデル:

| モデル | 説明 |
|--------|------|
| `Diagnosis` | 診断データ。ユーザーの診断結果を格納 |
| `TrainingLabel` | 学習ラベル。AI モデルの学習データ管理 |
| `EngineConfig` | エンジン設定。推論エンジンのパラメータ |

### 5.2 Prisma コマンド

```bash
# Prisma Client の生成（スキーマ変更後に必ず実行）
npm run db:generate

# スキーマをデータベースに反映（開発用、マイグレーションファイルなし）
npm run db:push

# Prisma Studio 起動（ブラウザでDBを閲覧・編集）
npm run db:studio
```

### 5.3 マイグレーション（本番環境）

本番環境ではマイグレーションファイルを使用して変更を管理します。

```bash
# マイグレーションファイルの作成
npx prisma migrate dev --name <migration-name>

# 本番環境へのマイグレーション適用
npx prisma migrate deploy

# マイグレーション状態の確認
npx prisma migrate status
```

### 5.4 データベースのリセット（開発環境のみ）

```bash
# 全データ削除 + スキーマ再作成
npx prisma migrate reset
```

> **警告**: `migrate reset` は全データを削除します。本番環境では絶対に実行しないでください。

### 5.5 Docker 環境のデータベース接続

Docker 環境で起動した PostgreSQL に直接接続する場合:

```bash
# psql で接続
docker compose exec db psql -U rankme -d rankme

# Prisma Studio をホストから使用（DATABASE_URL を localhost に変更）
DATABASE_URL="postgresql://rankme:rankme@localhost:5432/rankme" npx prisma studio
```

---

## 6. AI推論サービス

### 6.1 概要

AI サービスは FastAPI ベースの推論サーバーです。画像の類似度判定などの推論処理を担当します。

### 6.2 エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `POST` | `/predict` | 推論リクエスト |
| `GET` | `/health` | ヘルスチェック |

### 6.3 エンジンレジストリ

`ai/engine_registry.py` で推論エンジンを管理しています。環境変数 `RANKME_ENGINE` で使用するエンジンを切り替えます。

**デフォルトエンジン**: `similarity_v1`（`ai/engines/similarity_v1.py`）

### 6.4 カスタムエンジンの追加

1. `ai/engines/` ディレクトリに新しいエンジンファイルを作成します。

```python
# ai/engines/my_custom_engine.py

class MyCustomEngine:
    def __init__(self):
        # モデルのロードなど初期化処理
        pass

    def predict(self, data):
        # 推論ロジック
        result = ...
        return result
```

2. `ai/engine_registry.py` にエンジンを登録します。

```python
from engines.my_custom_engine import MyCustomEngine

ENGINES = {
    "similarity_v1": SimilarityV1Engine,
    "my_custom": MyCustomEngine,  # 追加
}
```

3. 環境変数を更新します。

```dotenv
RANKME_ENGINE="my_custom"
```

### 6.5 ローカルでの AI サービス起動

```bash
cd ai

# 仮想環境の作成（推奨）
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows

# 依存パッケージのインストール
pip install -r requirements.txt

# サーバー起動
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6.6 GPU 利用について

- **PyTorch** は CUDA 対応 GPU を自動検出します。GPU が利用可能な場合は自動的に GPU を使用します。
- GPU なしの環境では CPU にフォールバックしますが、推論速度は低下します。
- Docker 環境で GPU を使う場合は、[3.3 GPU を利用する場合](#33-gpu-を利用する場合)を参照してください。

---

## 7. トラブルシューティング

### データベース接続エラー

**症状**: `Error: P1001: Can't reach database server at 'db:5432'`

**原因と対処**:

| 原因 | 対処 |
|------|------|
| PostgreSQL が起動していない | `docker compose up -d db` で DB を起動 |
| ホスト名が間違っている | Docker 内は `db`、ホストからは `localhost` |
| ポートが競合している | `lsof -i :5432` で確認し、競合プロセスを停止 |
| 認証情報が間違っている | `.env` の `DATABASE_URL` を確認 |

```bash
# DB コンテナの状態を確認
docker compose ps db

# DB コンテナのログを確認
docker compose logs db
```

### Prisma Client のエラー

**症状**: `@prisma/client did not initialize yet`

**対処**:

```bash
# Prisma Client を再生成
npm run db:generate

# node_modules を再インストール
rm -rf node_modules
npm install
npm run db:generate
```

### AI サービスに接続できない

**症状**: `ECONNREFUSED` または `Failed to fetch` (AI サービス関連)

**対処**:

```bash
# AI サービスの状態を確認
curl http://localhost:8000/health

# Docker の場合
docker compose ps ai
docker compose logs ai

# ポートが正しいか確認
# Docker 内: http://ai:8000
# ホストから: http://localhost:8000
```

### Docker ビルドが失敗する

**症状**: `docker compose build` でエラー

**対処**:

```bash
# キャッシュなしで再ビルド
docker compose build --no-cache

# ディスク容量を確認
docker system df

# 不要なイメージ・コンテナを削除
docker system prune -f
```

### GPU が認識されない（Docker 環境）

**症状**: AI サービスが CPU フォールバックで動作する

**対処**:

```bash
# ホスト側で GPU が認識されているか確認
nvidia-smi

# NVIDIA Container Toolkit の動作確認
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Docker デーモンの再起動
sudo systemctl restart docker
```

### ポート競合

**症状**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**対処**:

```bash
# 使用中のプロセスを確認
lsof -i :3000   # Web
lsof -i :8000   # AI
lsof -i :5432   # DB

# プロセスを停止するか、docker-compose.yml でポートを変更
# 例: "3001:3000" で外部ポートを 3001 に変更
```

### npm install が失敗する

**症状**: 依存パッケージのインストールエラー

**対処**:

```bash
# Node.js バージョンを確認
node -v  # v20 以上であること

# キャッシュクリアして再インストール
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### TypeScript 型エラー

**症状**: `npm run type-check` でエラー

**対処**:

```bash
# 型チェックの実行
npm run type-check

# Prisma Client を再生成（型定義が古い場合）
npm run db:generate

# tsconfig.json のパスエイリアス確認
# @/* は src/* にマッピングされていること
```

---

## 補足

### プロジェクト構成図

```
rankme/
├── package.json            # プロジェクト設定・依存パッケージ
├── tsconfig.json           # TypeScript 設定（strict モード, @/* エイリアス）
├── next.config.mjs         # Next.js 設定（GCS リモートパターン含む）
├── tailwind.config.ts      # Tailwind CSS カスタムデザインシステム
├── postcss.config.mjs      # PostCSS 設定
├── prisma/
│   └── schema.prisma       # DB スキーマ定義
├── docker-compose.yml      # Docker サービス定義
├── Dockerfile              # Web サービスビルド（マルチステージ）
├── .env.example            # 環境変数テンプレート
├── ai/
│   ├── Dockerfile          # AI サービスビルド
│   ├── requirements.txt    # Python 依存パッケージ
│   ├── main.py             # FastAPI エントリーポイント
│   ├── engine_registry.py  # エンジン管理
│   └── engines/
│       └── similarity_v1.py  # デフォルト推論エンジン
└── src/
    ├── app/                # Next.js App Router（ページ + API ルート）
    ├── components/         # React コンポーネント
    └── lib/                # ユーティリティ・Prisma クライアント
```

### 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 14, React 18, Tailwind CSS, motion, lucide-react |
| バックエンド | Next.js API Routes, Prisma 6 |
| AI サービス | FastAPI, PyTorch, Pillow, numpy |
| データベース | PostgreSQL 16 |
| コンテナ | Docker, Docker Compose |
| 言語 | TypeScript (Web), Python 3.11 (AI) |

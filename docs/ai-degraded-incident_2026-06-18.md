# AI Service Degraded インシデント記録 (2026-06-18)

`/api/health` が `{"status":"degraded","db":true,"ai":false}` を返していた事象について、原因確定と再発防止案を記録する。

---

## 1. 事象

- 本番URL: `https://rankme-tau.vercel.app/`
- `/api/health` レスポンス (発生時): `{"status":"degraded","db":true,"ai":false}` (HTTP 200, 0.6秒)
- ユーザー画面のサイト自体は表示されるが、AI評価機能(ランク判定)が動作しない状態。

---

## 2. 切り分けロジック (どう原因を絞ったか)

### Step 1. health エンドポイントの判定ロジックを確認

`src/app/api/health/route.ts` を読み、`ai:false` の判定条件を特定:

```ts
// 5秒タイムアウトで AI Service の /health に GET を投げ、
// ok でなければ aiHealthy = false にする
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000)
const response = await fetch(`${getAiServiceUrl()}/health`, {
  method: "GET", signal: controller.signal,
})
aiHealthy = response.ok
```

→ AI判定は「外部 AI Service の `/health` が **5秒以内に 200 系で応答するか**」のみ。
→ Anthropic API キーの問題ではなく、**自前の Python 推論サーバの到達可否** が論点だと確定。

### Step 2. AI Service の場所を特定

ローカル `.env.production.local`:

```
AI_SERVICE_URL="https://takeyani-rankme-ai.hf.space"
```

→ AI Service は **Hugging Face Spaces** にホスト。

### Step 3. AI Service を直接叩いて稼働確認

```bash
curl https://takeyani-rankme-ai.hf.space/health
# => HTTP 200, 1.4秒, {"status":"healthy","engine":"similarity_v1","version":"2.0.0"}
```

→ AI Service 自体は **生きている**。コードやキーの不備ではない。

### Step 4. 直叩き直後に Vercel /api/health を再叩き

```bash
curl https://rankme-tau.vercel.app/api/health
# => HTTP 200, 2.0秒, {"status":"healthy","db":true,"ai":true}
```

→ **自然回復**。直叩きが cold start を発火させ、HF Space が起きた瞬間に Vercel 側でも healthy になった。

---

## 3. 確定した原因

**Hugging Face Spaces (無料/CPU プラン) のスリープによる cold start タイムアウト**

| 要素 | 内容 |
|---|---|
| HF Space の挙動 | アイドル時間が一定を超えるとスリープに入る。スリープ状態からの初回リクエストは起動に **10〜30秒** 要する |
| Vercel `/api/health` のタイムアウト | `setTimeout(() => controller.abort(), 5000)` → **5秒**。HF cold start 時間より短い |
| 結果 | スリープ中の HF Space に対するチェックが毎回タイムアウト → `aiHealthy=false` → `status:degraded` |
| ユーザー影響 | サイト訪問者が AI 評価を行うと、初回は HF Space 起動待ちで応答が遅れる/失敗する |

なお `/api/diagnose` 側 (`AI_TIMEOUT_MS = 30_000`) は 30秒タイムアウトなので、cold start でも実利用は通る場面が多い。問題は health チェックと、初回ユーザー体験の悪化。

---

## 4. 再発防止案 (優先度順)

### A. ウォームアップ Cron (推奨・無料・即実装可)

Vercel Cron で 5〜10分おきに HF Space の `/health` を叩いて起こし続ける。

- 追加するもの:
  - `src/app/api/cron/wake-ai/route.ts` (HF Space `/health` を叩くだけのエンドポイント)
  - `vercel.json` に `crons` 設定を追加
- メリット: 完全無料、コード変更も最小、HF スリープ自体を防げる
- 注意: Vercel Hobby プランの Cron は 1日1回まで。**5-10分間隔は Pro 以上が必要**

### B. health タイムアウトの延長 (簡易・対症療法)

`route.ts:30` の `5000` → `15000` などに変更。

- メリット: 1行の修正
- 注意: Vercel Hobby は関数実行 10秒上限。Pro なら 15秒設定可
- デメリット: 対症療法。HF Space が cold のままだと **初回ユーザーは10秒以上待たされる**

### C. health の分離 (副案)

`/api/health/quick` を新設し DB のみチェック、AI は別エンドポイントに分離。

- メリット: 監視系の誤検知を防ぐ
- デメリット: ユーザー体験は変わらない (cold start 自体は残る)

### D. HF Space 有料化 (Always-On)

HF の CPU upgrade で常時稼働。

- メリット: 根本解決
- デメリット: 月額発生

### E. AI 推論を別ホストへ移行

Cloud Run / Fly.io / Render など Always-On 寄りのホストへ移行。

- メリット: 根本解決+スケーラビリティ
- デメリット: 移行工数 (中期)

---

## 5. 推奨アクション

1. **短期**: A (Vercel Cron でウォームアップ)。プランが Hobby なら、外部の無料 Cron (UptimeRobot 等) で代替可能。
2. **中期**: D または E。本番利用が増えるなら Always-On 化を検討。
3. **監視**: B は短期的にあわせて入れても良いが、根本対策が前提。

---

## 6. 関連ファイル

- `src/app/api/health/route.ts` — health 判定ロジック
- `src/app/api/diagnose/route.ts` — AI Service への実呼び出し (`AI_TIMEOUT_MS = 30_000`, ホスト allowlist あり)
- `.env.production.local` — `AI_SERVICE_URL` 定義 (Vercel 側 env も同期されているか要確認)
- `docker-compose.yml` — ローカル開発時の AI Service 構成
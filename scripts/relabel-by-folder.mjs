#!/usr/bin/env node
/**
 * Relabel by Folder — フォルダ名 ①〜⑩ を ground truth として TrainingLabel.rank を上書きする。
 *
 * 使い方:
 *   node scripts/relabel-by-folder.mjs [path-to-training-data]
 *
 * フォルダ→ランク対応:
 *   ① → 1, ② → 2, ..., ⑨ → 9, ⑩ → 10
 *
 * 動作:
 *   - 各画像のSHA256ハッシュを計算（bulk-importと同じロジック）
 *   - imageUrl が hash を含む TrainingLabel を検索
 *   - そのrank を folder name のランクに更新
 *   - labeledBy を "folder" にセット
 *
 * 冪等性: 既にfolder値と一致していればスキップ
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.production.local");
  try {
    const text = await fs.readFile(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*"?(.*?)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

// Unicode circled digits: ①=U+2460 ... ⑨=U+2468, ⑩=U+2469
const CIRCLED_TO_RANK = {
  "①": 1, "②": 2, "③": 3, "④": 4, "⑤": 5,
  "⑥": 6, "⑦": 7, "⑧": 8, "⑨": 9, "⑩": 10,
};

function rankFromFolder(folderName) {
  // folder name may include other chars; check for any circled digit
  for (const ch of folderName) {
    if (CIRCLED_TO_RANK[ch] !== undefined) return CIRCLED_TO_RANK[ch];
  }
  return null;
}

async function computeHash(filepath) {
  const buffer = await fs.readFile(filepath);
  return crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function walkPhotos(root) {
  const out = [];
  async function walk(dir, currentRank) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        const r = rankFromFolder(e.name) ?? currentRank;
        await walk(p, r);
      } else if (/\.(jpe?g|png)$/i.test(e.name) && !e.name.startsWith(".")) {
        out.push({ filepath: p, rank: currentRank });
      }
    }
  }
  await walk(root, null);
  return out;
}

async function main() {
  await loadEnv();
  if (!process.env.POSTGRES_URL_NON_POOLING && !process.env.POSTGRES_PRISMA_URL) {
    console.error("必須env未設定: POSTGRES_URL_NON_POOLING または POSTGRES_PRISMA_URL");
    process.exit(1);
  }

  const targetDir = process.argv[2] || path.resolve(__dirname, "..", "training-data");
  console.log(`対象ディレクトリ: ${targetDir}`);

  const files = await walkPhotos(targetDir);
  const withRank = files.filter((f) => f.rank !== null);
  const noRank = files.filter((f) => f.rank === null);

  console.log(`画像総数: ${files.length}`);
  console.log(`フォルダから rank 判定: ${withRank.length}`);
  if (noRank.length > 0) {
    console.log(`(skip) フォルダから判定不可: ${noRank.length}件 → そのまま`);
  }

  const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
  const prisma = new PrismaClient({ datasourceUrl: dbUrl });

  let updated = 0,
    alreadyOk = 0,
    notFound = 0,
    failed = 0;
  const rankChanges = {};

  for (let i = 0; i < withRank.length; i++) {
    const { filepath, rank: folderRank } = withRank[i];
    const rel = path.relative(targetDir, filepath);
    const tag = `[${i + 1}/${withRank.length}] ${rel}`;
    try {
      const hash = await computeHash(filepath);
      const existing = await prisma.trainingLabel.findFirst({
        where: { imageUrl: { contains: hash } },
        select: { id: true, rank: true },
      });
      if (!existing) {
        console.log(`${tag} NOT_FOUND (未インポートか)`);
        notFound++;
        continue;
      }
      if (existing.rank === folderRank) {
        alreadyOk++;
        continue;
      }
      await prisma.trainingLabel.update({
        where: { id: existing.id },
        data: { rank: folderRank, labeledBy: "folder" },
      });
      const key = `${existing.rank}→${folderRank}`;
      rankChanges[key] = (rankChanges[key] ?? 0) + 1;
      if (updated % 50 === 0) {
        console.log(`${tag} ${existing.rank} → ${folderRank}`);
      }
      updated++;
    } catch (err) {
      failed++;
      console.error(`${tag} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await prisma.$disconnect();

  console.log("");
  console.log("=== 結果 ===");
  console.log(`総数        : ${withRank.length}`);
  console.log(`更新        : ${updated}`);
  console.log(`既に一致    : ${alreadyOk}`);
  console.log(`DBに無い    : ${notFound}`);
  console.log(`失敗        : ${failed}`);
  if (Object.keys(rankChanges).length > 0) {
    console.log("");
    console.log("ランク変動（before→after: 件数）:");
    const sorted = Object.entries(rankChanges).sort((a, b) => b[1] - a[1]);
    for (const [k, v] of sorted) console.log(`  ${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

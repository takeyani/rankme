#!/usr/bin/env node
/**
 * Bulk Import — training-data/ にある全写真をAIに判定させ、Supabase Storage にアップロード、
 * TrainingLabel テーブルに登録する。
 *
 * 使い方（プロジェクトルートで）:
 *   1. .env.production.local に以下の3つの値が必要:
 *      - SUPABASE_URL
 *      - SUPABASE_SERVICE_ROLE_KEY
 *      - POSTGRES_PRISMA_URL
 *      `vercel env pull .env.production.local --environment=production` で取得可能。
 *   2. node scripts/bulk-import.mjs [path-to-training-data]
 *      省略時は `./training-data` を見にいく
 *
 * 冪等性:
 *   - 同じ imageUrl のレコードがあればスキップ（再実行しても二重登録されない）
 *   - 失敗時はそのファイルだけ飛ばして次へ進み、最後にサマリーを出す
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.production.local をロード（dotenv なしで自前パース）
async function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.production.local");
  try {
    const text = await fs.readFile(envPath, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z_0-9]*)\s*=\s*"?(.*?)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    console.warn(`(skip) .env.production.local が見つかりません: ${envPath}`);
  }
}

const SUPABASE_BUCKET = "training-photos";
const AI_URL = process.env.AI_SERVICE_URL || "https://takeyani-rankme-ai.hf.space";

async function ensureBucket() {
  const url = `${process.env.SUPABASE_URL}/storage/v1/bucket`;
  const headers = {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: true }),
  });
  if (res.status === 200 || res.status === 409 /* already exists */) return;
  const body = await res.text();
  throw new Error(`Bucket creation failed: ${res.status} ${body}`);
}

async function uploadToStorage(filepath, hash) {
  const ext = path.extname(filepath).toLowerCase();
  const objectPath = `${hash}${ext}`;
  const url = `${process.env.SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`;
  const buffer = await fs.readFile(filepath);
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body}`);
  }
  // public URL
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectPath}`;
}

async function predictRank(filepath) {
  const buffer = await fs.readFile(filepath);
  const fd = new FormData();
  fd.append("image", new Blob([buffer], { type: "image/jpeg" }), path.basename(filepath));
  const res = await fetch(`${AI_URL}/predict`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI predict failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return { rank: data.rank, confidence: data.confidence, engine: data.engine };
}

async function walkPhotos(root) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(jpe?g|png)$/i.test(e.name) && !e.name.startsWith(".")) out.push(p);
    }
  }
  await walk(root);
  return out;
}

function computeHash(filepath) {
  return new Promise(async (resolve, reject) => {
    try {
      const buffer = await fs.readFile(filepath);
      const hash = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 16);
      resolve(hash);
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  await loadEnv();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.POSTGRES_PRISMA_URL) {
    console.error("必須env未設定: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, POSTGRES_PRISMA_URL");
    console.error("先に: vercel env pull .env.production.local --environment=production");
    process.exit(1);
  }

  const targetDir =
    process.argv[2] || path.resolve(__dirname, "..", "training-data");
  console.log(`対象ディレクトリ: ${targetDir}`);

  const files = await walkPhotos(targetDir);
  console.log(`見つかった画像: ${files.length}件`);
  if (files.length === 0) return;

  await ensureBucket();
  console.log(`Supabase bucket "${SUPABASE_BUCKET}" 確認OK`);

  const prisma = new PrismaClient({ datasourceUrl: process.env.POSTGRES_PRISMA_URL });

  let imported = 0,
    skipped = 0,
    failed = 0;
  const failures = [];

  for (let i = 0; i < files.length; i++) {
    const fp = files[i];
    const tag = `[${i + 1}/${files.length}] ${path.relative(targetDir, fp)}`;
    try {
      const hash = await computeHash(fp);

      // 既存チェック (imageUrlにhashが含まれていれば同一ファイル)
      const existing = await prisma.trainingLabel.findFirst({
        where: { imageUrl: { contains: hash } },
        select: { id: true },
      });
      if (existing) {
        console.log(`${tag} skip (already imported)`);
        skipped++;
        continue;
      }

      const url = await uploadToStorage(fp, hash);
      const { rank, engine } = await predictRank(fp);

      await prisma.trainingLabel.create({
        data: {
          imageUrl: url,
          rank,
          labeledBy: `bulk-ai:${engine}`,
        },
      });
      console.log(`${tag} → rank=${rank}`);
      imported++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ file: fp, error: msg });
      console.error(`${tag} FAILED: ${msg}`);
    }

    // soft pacing to avoid hammering AI
    await new Promise((r) => setTimeout(r, 150));
  }

  await prisma.$disconnect();

  console.log("");
  console.log("=== 結果 ===");
  console.log(`総数  : ${files.length}`);
  console.log(`新規  : ${imported}`);
  console.log(`スキップ: ${skipped}`);
  console.log(`失敗  : ${failed}`);
  if (failures.length > 0 && failures.length <= 20) {
    console.log("");
    console.log("失敗詳細:");
    for (const f of failures) console.log(`  ${path.basename(f.file)}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

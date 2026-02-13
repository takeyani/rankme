"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConsentDialogProps {
  onAccept: () => void;
  open: boolean;
}

export function ConsentDialog({ onAccept, open }: ConsentDialogProps) {
  const [agreed, setAgreed] = React.useState(false);

  const handleAccept = () => {
    if (agreed) {
      onAccept();
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl text-center">
            ご利用にあたって
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 text-sm text-[var(--text-secondary)] leading-relaxed">
          <p>
            RankMeは、アップロードされた顔写真をAIが分析し、選別済み画像データとの類似度および傾向に基づいて1〜10のランクを判定するサービスです。
          </p>

          <div className="space-y-2">
            <p className="font-medium text-[var(--text-primary)]">
              本サービスについて:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>判定結果は統計的な傾向分析に基づくものであり、絶対的な評価ではありません</li>
              <li>個人の価値や魅力を断定するものではありません</li>
              <li>アップロードされた画像は診断処理後に削除されます</li>
              <li>結果はエンターテインメントとして参考にしてください</li>
            </ul>
          </div>

          <p>
            精神的に不安定な状態にある方や、外見に関する結果がストレスになり得る方のご利用はお控えください。
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] accent-[var(--accent)]"
          />
          <span className="text-sm text-[var(--text-primary)]">
            上記の内容を理解し、同意します
          </span>
        </label>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!agreed}
            className="w-full"
            size="lg"
          >
            同意して利用する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

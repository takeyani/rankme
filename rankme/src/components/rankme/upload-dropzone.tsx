"use client";

import * as React from "react";
import { Upload, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  maxSizeBytes?: number;
  acceptedTypes?: string[];
  disabled?: boolean;
  className?: string;
}

export function UploadDropzone({
  onFileSelect,
  maxSizeBytes = 5 * 1024 * 1024,
  acceptedTypes = ["image/jpeg", "image/png"],
  disabled = false,
  className,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `対応していないファイル形式です。${acceptedTypes.map((t) => t.split("/")[1].toUpperCase()).join(", ")} のみ対応しています。`;
    }
    if (file.size > maxSizeBytes) {
      const maxMB = Math.round(maxSizeBytes / (1024 * 1024));
      return `ファイルサイズが大きすぎます。最大 ${maxMB}MB まで対応しています。`;
    }
    return null;
  };

  const handleFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setFileName(file.name);

    const url = URL.createObjectURL(file);
    setPreview(url);

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  React.useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  return (
    <div className={cn("w-full", className)}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={
          preview
            ? `選択済み: ${fileName}`
            : "顔写真をアップロード"
        }
        aria-live="polite"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed transition-colors duration-150",
          "min-h-[200px] md:min-h-[300px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && !preview && "cursor-pointer",
          isDragOver && !disabled
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : error
              ? "border-[var(--danger)]"
              : "border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5"
        )}
      >
        {preview ? (
          <div className="relative flex flex-col items-center gap-3 p-4">
            <div className="relative">
              <img
                src={preview}
                alt="選択された画像のプレビュー"
                className="max-h-[200px] md:max-h-[260px] rounded-[var(--radius-image)] object-contain"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearPreview();
                }}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="選択をクリア"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {fileName && (
              <p className="text-xs text-[var(--text-secondary)] truncate max-w-[240px]">
                {fileName}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6">
            <Upload
              className={cn(
                "h-8 w-8 text-[var(--text-secondary)] transition-transform duration-150",
                isDragOver && "scale-110 text-[var(--accent)]"
              )}
            />
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {isDragOver
                  ? "ここにドロップ"
                  : "写真をドラッグ&ドロップ または クリックして選択"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {acceptedTypes
                  .map((t) => t.split("/")[1].toUpperCase())
                  .join(", ")}{" "}
                / 最大{Math.round(maxSizeBytes / (1024 * 1024))}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-xs text-[var(--danger)]"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes.join(",")}
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

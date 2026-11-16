"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type UIEvent } from "react";
import { ACCEPTED_FILE_EXTENSIONS, MAX_UPLOAD_BYTES, detectLanguage, isSupportedFilename, languageFromFilename, languageLabel } from "@/lib/languages";
import { LANGUAGES, MAX_CODE_CHARS, type LanguageId } from "@/schemas/review";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: LanguageId | "auto";
  onLanguageChange: (lang: LanguageId | "auto") => void;
  error: string | null;
  onErrorChange: (message: string | null) => void;
  onFileLoaded: (fileName: string, text: string, detected: LanguageId | null) => void;
  onLoadSample: () => void;
  onSubmitShortcut: () => void;
  disabled?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
  error,
  onErrorChange,
  onFileLoaded,
  onLoadSample,
  onSubmitShortcut,
  disabled = false,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const lineCount = useMemo(() => Math.max(1, value.split("\n").length), [value]);
  const autoDetected = useMemo(() => (language === "auto" ? detectLanguage(value) : null), [language, value]);
  const charCount = value.length;
  const overLimit = charCount > MAX_CODE_CHARS;
  const nearLimit = charCount > MAX_CODE_CHARS * 0.9;

  function handleScroll(e: UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmitShortcut();
      return;
    }
    // Keep Tab usable for indentation inside the editor.
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart, selectionEnd } = el;
      const next = value.slice(0, selectionStart) + "  " + value.slice(selectionEnd);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = selectionStart + 2;
      });
    }
  }

  async function readFile(file: File) {
    if (!isSupportedFilename(file.name)) {
      onErrorChange(
        `Unsupported file type ".${file.name.split(".").pop() ?? ""}". Accepted: ${ACCEPTED_FILE_EXTENSIONS.map((e) => `.${e}`).join(", ")}`,
      );
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onErrorChange(`File is too large (${Math.round(file.size / 1024)} KB). Maximum is ${MAX_UPLOAD_BYTES / 1024} KB.`);
      return;
    }
    try {
      const text = await file.text();
      if (text.includes("\u0000")) {
        onErrorChange("This file looks binary, not text. Please upload a source file.");
        return;
      }
      setFileName(file.name);
      onFileLoaded(file.name, text, languageFromFilename(file.name));
    } catch {
      onErrorChange("Could not read that file. Try again or paste the code instead.");
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void readFile(file);
  }

  const describedBy = ["code-help", error ? "code-error" : null].filter(Boolean).join(" ");

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="language" className="block text-xs font-medium text-zinc-400">
              Language
            </label>
            <select
              id="language"
              value={language}
              disabled={disabled}
              onChange={(e) => onLanguageChange(e.target.value as LanguageId | "auto")}
              className="field !w-auto !py-2 pr-8"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id === "auto" && autoDetected ? `Auto: ${languageLabel(autoDetected)}` : l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled} className="btn-ghost">
              <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 13V3m0 0L6.5 6.5M10 3l3.5 3.5M4 13v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3" />
              </svg>
              Upload file
            </button>
            <button type="button" onClick={onLoadSample} disabled={disabled} className="btn-ghost">
              Load sample code
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_EXTENSIONS.map((e) => `.${e}`).join(",")}
            onChange={handleFileInput}
            className="sr-only"
            tabIndex={-1}
            aria-label="Upload a source file"
          />
        </div>
        <p
          id="code-help"
          className={`font-mono text-xs tabular-nums ${overLimit ? "text-sev-critical" : nearLimit ? "text-sev-medium" : "text-muted"}`}
          aria-live="polite"
        >
          {fileName ? <span className="mr-2 text-zinc-400">{fileName} ·</span> : null}
          {charCount.toLocaleString("en-US")} / {MAX_CODE_CHARS.toLocaleString("en-US")} chars
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative flex min-h-[340px] flex-1 overflow-hidden rounded-2xl border bg-[#060708] transition duration-200 focus-within:border-accent/50 focus-within:shadow-[0_0_0_4px_rgba(198,255,61,0.08)] ${
          error ? "border-sev-critical/60" : "border-line"
        } ${dragging ? "border-accent border-dashed bg-accent/[0.03]" : ""}`}
      >
        <div
          ref={gutterRef}
          aria-hidden
          className="select-none overflow-hidden border-r border-line bg-surface py-3.5 pr-3 pl-3 text-right font-mono text-[12.5px] leading-6 text-zinc-600"
          style={{ minWidth: `${Math.max(3, String(lineCount).length + 1)}ch` }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <label htmlFor="code-input" className="sr-only">
          Code to review
        </label>
        <textarea
          id="code-input"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (error) onErrorChange(null);
          }}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          placeholder={"// Paste code here, drop a file, or load the sample.\n// Tip: press Ctrl/Cmd + Enter to run the review."}
          aria-invalid={Boolean(error) || overLimit}
          aria-describedby={describedBy}
          className="min-h-[340px] w-full flex-1 resize-y bg-transparent py-3.5 pr-4 pl-3 font-mono text-[12.5px] leading-6 whitespace-pre text-zinc-100 placeholder:text-zinc-600 focus:outline-none disabled:opacity-60"
        />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-base/70 backdrop-blur-sm">
            <p className="font-mono text-sm text-accent">Drop your source file</p>
          </div>
        )}
      </div>

      {error && (
        <p id="code-error" role="alert" className="flex items-start gap-2 text-sm text-sev-critical animate-fade-up">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      )}
      {overLimit && !error && (
        <p role="alert" className="text-sm text-sev-critical">
          Over the limit by {(charCount - MAX_CODE_CHARS).toLocaleString("en-US")} characters. Shorten the snippet to review it.
        </p>
      )}
    </div>
  );
}

'use client';

import { useRef } from 'react';
import { FileText, Image, Paperclip, X } from 'lucide-react';
import { notify } from '@/components/ui/AppToaster';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 3;
const ACCEPTED_EXTENSIONS = new Set(['csv', 'pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'webp']);

export function AskAttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (selected: FileList | null) => {
    if (!selected?.length) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ACCEPTED_EXTENSIONS.has(extension)) {
        notify.error(`${file.name}: file type is not supported.`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        notify.error(`${file.name}: maximum file size is 10 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        notify.error('Ask accepts up to 3 files per message.');
        break;
      }
      if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) next.push(file);
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Files attached to Ask">
          {files.map((file, index) => {
            const isImage = /\.(png|jpe?g|webp)$/i.test(file.name);
            const Icon = isImage ? Image : FileText;
            return (
              <li key={`${file.name}-${file.size}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#d9dfd5] bg-white px-2 py-1 text-[11px] text-[#465342] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75">
                <Icon size={13} className="shrink-0 text-emerald-700 dark:text-emerald-300" />
                <span className="max-w-40 truncate">{file.name}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-[#687064] hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 dark:text-white/55 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                >
                  <X size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
          disabled={disabled}
          aria-label="Attach CSV, PDF, Word document, or image"
          className="sr-only"
          onChange={(event) => {
            addFiles(event.currentTarget.files);
            event.currentTarget.value = '';
          }}
        />
        <button
          type="button"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40 dark:text-emerald-300 dark:hover:bg-white/10"
        >
          <Paperclip size={14} />
          {files.length ? `Add file (${files.length}/${MAX_FILES})` : 'Attach a file'}
        </button>
        <p className="text-right text-[10px] leading-relaxed text-[#687064] dark:text-white/50">
          CSV, PDF, DOC/DOCX or image · 10 MB max each · analyzed by your Ask AI provider, not stored
        </p>
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload, UserRound } from 'lucide-react';
import { customersAPI } from '@/lib/api/customers';

const MAX_COMPRESSED_BYTES = 128 * 1024;

export function CustomerAvatar({
  customerId,
  photoId,
  className = '',
}: {
  customerId: string;
  photoId?: string | null;
  className?: string;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!photoId) {
      setUrl('');
      return;
    }
    let active = true;
    let objectUrl = '';
    customersAPI.getPhoto(customerId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(() => { if (active) setUrl(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customerId, photoId]);

  return <div role="img" aria-label={url ? 'Customer photo' : 'Customer photo placeholder'} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-[#17231c] dark:text-emerald-300 ${className}`}>
    {url ? <Image unoptimized fill sizes="64px" src={url} alt="Customer" className="object-cover" /> : <UserRound aria-hidden="true" size={21} />}
  </div>;
}

async function compressCustomerPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Chagua picha ya JPG, PNG au WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Picha isiwe kubwa kuliko MB 15.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Picha haikuweza kufunguliwa. Jaribu picha nyingine.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000)
      throw new Error('Picha ina ukubwa mkubwa sana.');
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser imeshindwa kuandaa picha.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.74, 0.62, 0.5, 0.38]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
      if (blob && blob.size <= MAX_COMPRESSED_BYTES) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('Picha iliyobanwa haikuweza kusomwa.'));
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Picha si sahihi.'));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error('Picha bado ni kubwa baada ya kubanwa. Chagua picha rahisi au ndogo.');
  } finally { bitmap.close(); }
}

export function CustomerPhotoField({
  customerId,
  photoId,
  value,
  onChange,
  disabled = false,
}: {
  customerId?: string;
  photoId?: string | null;
  /** undefined keeps the stored image; null removes it; a data URL replaces it. */
  value: string | null | undefined;
  onChange: (photo: string | null) => void;
  disabled?: boolean;
}) {
  const [existingUrl, setExistingUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!customerId || !photoId || value !== undefined) {
      setExistingUrl('');
      return;
    }
    let active = true;
    let objectUrl = '';
    customersAPI.getPhoto(customerId).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setExistingUrl(objectUrl);
    }).catch(() => { if (active) setExistingUrl(''); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [customerId, photoId, value]);

  const preview = value === undefined ? existingUrl : value || '';
  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try { onChange(await compressCustomerPhoto(file)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Picha haikuweza kuandaliwa.'); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[#cde9d9] bg-emerald-50/65 p-4 dark:border-emerald-950 dark:bg-[#141a16]" aria-labelledby="customer-photo-heading">
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-emerald-200 bg-white text-emerald-800 shadow-sm dark:border-emerald-900 dark:bg-[#111411] dark:text-emerald-300">
        {preview ? <Image unoptimized fill sizes="96px" src={preview} alt="Customer photo preview" className="object-cover" /> : <UserRound aria-hidden="true" size={32} />}
        {busy ? <div className="absolute inset-0 grid place-items-center bg-black/45 text-white"><Loader2 size={22} className="animate-spin" /></div> : null}
      </div>
      <div className="min-w-0 flex-1">
        <h2 id="customer-photo-heading" className="flex items-center gap-2 text-sm font-bold text-[#08784f] dark:text-emerald-300"><ImagePlus size={17}/>Picha ya customer</h2>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#606b60] dark:text-white/60">Hiari. Chagua JPG, PNG au WebP; tutapunguza ukubwa na kuihifadhi ili ionekane kwenye orodha na profile.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500 ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}>
            <Upload size={14}/>{busy ? 'Inaandaa…' : preview ? 'Badilisha picha' : 'Chagua picha'}
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={(event) => { void choose(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
          </label>
          {preview ? <button type="button" disabled={disabled || busy} onClick={() => { setError(''); onChange(null); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"><Trash2 size={14}/>Ondoa picha</button> : null}
        </div>
      </div>
    </div>
    {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</p> : null}
  </section>;
}

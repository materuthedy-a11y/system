'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, ImagePlus, Moon, Palette, Sun, Trash2, X } from 'lucide-react';
import { notify } from '@/components/ui/AppToaster';

const PHOTO_KEY = 'genuine.theme.photo.image';
const PHOTO_ENABLED_KEY = 'genuine.theme.photo.enabled';
const GLASS_KEY = 'genuine.theme.photo.glass.v2';
const DEFAULT_GLASS = 82;

function readImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The selected image could not be opened.')); };
    image.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the image.'));
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.readAsDataURL(blob);
  });
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState('');
  const [photoEnabled, setPhotoEnabled] = useState(false);
  const [glass, setGlass] = useState(DEFAULT_GLASS);
  const [savingImage, setSavingImage] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      setPhoto(localStorage.getItem(PHOTO_KEY) || '');
      setPhotoEnabled(localStorage.getItem(PHOTO_ENABLED_KEY) === 'true');
      setGlass(Number(localStorage.getItem(GLASS_KEY)) || DEFAULT_GLASS);
    } catch { /* Theme selection remains usable when storage is unavailable. */ }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const html = document.documentElement;
    if (photoEnabled) {
      html.dataset.photoTheme = 'true';
      html.style.setProperty('--photo-glass-opacity', String(Math.min(0.98, Math.max(0.55, glass / 100))));
      if (photo) html.style.setProperty('--photo-background-image', `url("${photo}")`);
      else html.style.removeProperty('--photo-background-image');
    } else {
      delete html.dataset.photoTheme;
      html.style.removeProperty('--photo-glass-opacity');
      html.style.removeProperty('--photo-background-image');
    }
  }, [mounted, photoEnabled, photo, glass]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [open]);

  const selectTheme = (theme: 'light' | 'dark' | 'photo') => {
    const usePhoto = theme === 'photo';
    setPhotoEnabled(usePhoto);
    try { localStorage.setItem(PHOTO_ENABLED_KEY, String(usePhoto)); } catch { /* In-memory theme still works. */ }
    setTheme(theme === 'light' ? 'light' : 'dark');
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify.error('Chagua picha ya JPG, PNG au WebP.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify.error('Picha iwe chini ya MB 12 ili theme isibebe app.');
      return;
    }
    setSavingImage(true);
    try {
      const image = await readImage(file);
      const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this image.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.78));
      if (!blob) throw new Error('Your browser could not prepare this image.');
      if (blob.size > 1_500_000) blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.56));
      if (!blob || blob.size > 1_500_000) throw new Error('Picha bado ni kubwa. Chagua picha nyepesi zaidi.');
      const data = await blobToDataUrl(blob);
      localStorage.setItem(PHOTO_KEY, data);
      setPhoto(data);
      selectTheme('photo');
      notify.success('Picha ya mandhari imehifadhiwa kwenye kifaa hiki.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Imeshindikana kuhifadhi picha hii.');
    } finally { setSavingImage(false); }
  };

  const updateGlass = (value: number) => {
    setGlass(value);
    try { localStorage.setItem(GLASS_KEY, String(value)); } catch { /* Keep this session setting in memory. */ }
  };

  const active = photoEnabled ? 'photo' : resolvedTheme === 'dark' ? 'dark' : 'light';
  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-label="Theme settings" title="Theme settings" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} disabled={!mounted} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#e8e9e5] bg-white text-[#4f544c] transition hover:bg-[#f1f2ee] disabled:opacity-70 dark:border-[#353b34] dark:bg-[#1b1f1a] dark:text-[#e9ede5] dark:hover:bg-[#282e27] sm:h-10 sm:w-10">
        {active === 'photo' ? <Palette size={17} aria-hidden="true" /> : active === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      </button>
      {open ? <div role="dialog" aria-label="Appearance and background settings" className="fixed inset-x-3 top-[76px] z-[80] max-h-[calc(100vh-5.5rem)] max-h-[calc(100dvh-5.5rem)] overflow-y-auto rounded-2xl border border-[#dfe4dc] bg-white p-4 text-[#26312b] shadow-[0_20px_70px_rgba(8,18,14,0.25)] dark:border-white/10 dark:bg-[#1a2427] dark:text-[#edf2ee] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-[min(90vh,560px)] sm:w-[340px]">
        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">Appearance</p><p className="mt-1 text-xs text-[#6b756e] dark:text-white/60">Choose a calm workspace look.</p></div><button type="button" onClick={() => setOpen(false)} aria-label="Close appearance settings" className="rounded-lg p-1 text-[#6b756e] hover:bg-black/5 dark:text-white/65 dark:hover:bg-white/10"><X size={16}/></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Theme">
          {([['light','Light',Sun],['dark','Dark',Moon],['photo','Photo glass',Palette]] as const).map(([value,label,Icon]) => <button key={value} type="button" aria-pressed={active===value} onClick={() => selectTheme(value)} className={`flex min-h-[66px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-semibold transition ${active===value?'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/15 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-100':'border-[#e3e7e1] bg-[#f8f9f7] text-[#4b554d] hover:border-emerald-500/60 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/75'}`}><Icon size={17}/>{label}{active===value?<Check size={13} className="absolute sr-only"/>:null}</button>)}
        </div>
        <div className="mt-4 rounded-xl border border-[#e6e9e4] p-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold">Photo background</p><p className="mt-1 text-[11px] leading-4 text-[#6b756e] dark:text-white/60">Only you see it on this device. JPG, PNG or WebP.</p></div>{photo?<button type="button" aria-label="Remove background photo" title="Remove background photo" onClick={() => { localStorage.removeItem(PHOTO_KEY); setPhoto(''); }} className="rounded-lg p-2 text-[#758078] hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-300"><Trash2 size={15}/></button>:null}</div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose background photo" onChange={(event) => void handleImage(event)} />
          <button type="button" disabled={savingImage} onClick={() => inputRef.current?.click()} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-700/25 bg-emerald-50 px-3 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/70"><ImagePlus size={15}/>{savingImage?'Preparing photo…':photo?'Change background photo':'Choose a background photo'}</button>
        </div>
        {active==='photo'?<label className="mt-4 block"><span className="flex justify-between text-xs font-semibold"><span>Glass opacity</span><span>{glass}%</span></span><input aria-label="Glass opacity" className="mt-2 w-full accent-emerald-600" type="range" min="55" max="98" value={glass} onChange={(event)=>updateGlass(Number(event.target.value))}/><span className="mt-1 flex justify-between text-[10px] text-[#737d75] dark:text-white/50"><span>More transparent</span><span>More solid</span></span></label>:null}
        <p className="mt-3 text-[10px] leading-4 text-[#737d75] dark:text-white/50">Photo mode uses a dim overlay and frosted surfaces so text stays readable. The image is resized and stored locally; it is not uploaded.</p>
      </div>:null}
    </div>
  );
}

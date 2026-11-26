'use client';

import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { Download, FileUp, Loader2, X } from 'lucide-react';
import { suppliersAPI, type SupplierInput, type SupplierImportDetail } from '@/lib/api/suppliers';
import type { BulkImportResult } from '@/lib/api/suppliers';
import { getApiError } from '@/lib/api';
import { notify } from '@/components/ui/AppToaster';

const TEMPLATE =
  'name,supplierCode,email,phone,secondaryPhone,bankName,bankAccountNumber,bankSwiftCode,taxId,creditLimit,paymentTerms,openingBalance,isActive,description,street,city,region,postalCode,country\n' +
  'Azam Beverages Ltd,SUP-001,orders@azambeverages.co.tz,255655123456,,CRDB Bank,0150123456789,CRDBTZTZ,987654321,2000000,CASH,0,true,Main beverage distributor,Morogoro Road,Dar es Salaam,Dar es Salaam,11101,Tanzania\n';

const PAYMENT_TERMS = ['NET-7', 'NET-14', 'NET-30', 'NET-45', 'NET-60', 'CASH'];

type Row = Record<string, string>;

function num(v: string | undefined, fallback = 0) {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function truthy(v: string | undefined) {
  const value = (v ?? '').trim().toLowerCase();
  return !(value === 'false' || value === 'no' || value === '0' || value === 'inactive');
}

export function ImportSuppliersModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkImportResult<SupplierImportDetail> | null>(null);
  const [parseError, setParseError] = useState('');

  if (!open) return null;

  const reset = () => { setRows([]); setFileName(''); setResult(null); setParseError(''); };

  const onFile = (file: File) => {
    reset();
    setFileName(file.name);
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        if (!res.meta.fields?.length) { setParseError('No columns found in the CSV file.'); return; }
        setRows(res.data.filter((r) => Object.values(r).some((v) => String(v ?? '').trim())));
      },
      error: () => setParseError('Could not read this CSV file.'),
    });
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'suppliers-import-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const suppliers: SupplierInput[] = [];
      for (const r of rows) {
        const name = (r.name ?? '').trim();
        if (!name) continue;
        const terms = (r.paymentterms ?? '').trim().toUpperCase();
        const address = {
          street: (r.street ?? '').trim(),
          city: (r.city ?? '').trim(),
          region: (r.region ?? '').trim(),
          postalCode: (r.postalcode ?? '').trim(),
          country: (r.country ?? '').trim() || undefined,
        };
        suppliers.push({
          name,
          supplierCode: (r.suppliercode ?? '').trim() || undefined,
          email: (r.email ?? '').trim(),
          phone: (r.phone ?? '').trim(),
          secondaryPhone: (r.secondaryphone ?? '').trim() || undefined,
          bankName: (r.bankname ?? '').trim() || undefined,
          bankAccountNumber: (r.bankaccountnumber ?? '').trim() || undefined,
          bankSwiftCode: (r.bankswiftcode ?? '').trim() || undefined,
          taxId: (r.taxid ?? '').trim() || undefined,
          creditLimit: (r.creditlimit ?? '').trim() ? num(r.creditlimit) : undefined,
          paymentTerms: (PAYMENT_TERMS.includes(terms) ? terms : 'CASH') as SupplierInput['paymentTerms'],
          openingBalance: num(r.openingbalance),
          isActive: truthy(r.isactive),
          description: (r.description ?? '').trim() || undefined,
          address: Object.values(address).some(Boolean) ? address : undefined,
        });
      }
      if (!suppliers.length) {
        notify.error('Nothing to import. Check the CSV columns and try again.');
        return;
      }
      const res = await suppliersAPI.bulkImport(suppliers);
      setResult(res);
      if (res.failed) notify.warning(`Import finished: ${res.successful}/${res.total} created, ${res.failed} failed.`);
      else notify.success(`Import finished: ${res.successful} suppliers created.`);
      if (res.successful > 0) onDone();
    } catch (e) {
      notify.error(getApiError(e, 'Could not import suppliers.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    (typeof document !== 'undefined' ? createPortal(<div className="fixed inset-0 ui-modal-backdrop z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[#e6e9e1] bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#161a15]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#20231f] dark:text-white">Import suppliers from CSV</h2>
            <p className="mt-1 text-sm text-[#687064] dark:text-white/55">Upload a CSV with columns: name, email, phone, paymentTerms (optional: supplierCode, bank details, creditLimit, openingBalance, isActive, address fields).</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#687064] hover:bg-black/5 dark:hover:bg-white/10" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-2 rounded-xl border border-[#dfe5d3] px-3 py-2 text-sm font-semibold text-[#46523a] hover:bg-[#f4f8e7] dark:border-white/10 dark:text-white/70">
            <Download size={15} /> Download template
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-[#ff7600] px-3 py-2 text-sm font-bold text-white hover:bg-[#e96d00]">
            <FileUp size={15} /> {fileName || 'Choose CSV file'}
          </button>
          {rows.length > 0 && !result && <span className="text-sm font-semibold text-[#46523a] dark:text-white/70">{rows.length} rows ready</span>}
        </div>
        {parseError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{parseError}</p>}

        {result && (
          <div className="mt-4 max-h-56 overflow-auto rounded-xl border border-[#e6e9e1] dark:border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-[#f4f8e7] dark:bg-white/5"><tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Detail</th></tr></thead>
              <tbody>
                {result.details.map((d, i) => (
                  <tr key={i} className="border-t border-[#eef1e6] dark:border-white/5">
                    <td className="px-3 py-1.5 font-mono text-xs">{d.name}</td>
                    <td className={`px-3 py-1.5 font-semibold ${d.success ? 'text-emerald-600' : 'text-red-600'}`}>{d.success ? 'Created' : 'Failed'}</td>
                    <td className="px-3 py-1.5 text-xs text-[#687064] dark:text-white/55">{d.error ?? d.code ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-[#dfe5d3] px-4 py-2 text-sm font-semibold text-[#46523a] dark:border-white/10 dark:text-white/70">{result ? 'Close' : 'Cancel'}</button>
          {!result && (
            <button type="button" onClick={submit} disabled={busy || !rows.length} className="inline-flex items-center gap-2 rounded-xl bg-[#173d31] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4a3b] disabled:opacity-50">
              {busy && <Loader2 size={15} className="animate-spin" />} Import {rows.length || ''} suppliers
            </button>
          )}
        </div>
      </div>
    </div>, document.body) : null)
  );
}

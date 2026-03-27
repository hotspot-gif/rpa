import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { ImportLog } from '@/types';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertTriangle, X, Clock, RotateCcw } from 'lucide-react';

export default function DataImport() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    loadImportLogs();
  }, []);

  const loadImportLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('import_log')
      .select('*')
      .order('imported_at', { ascending: false })
      .limit(20);
    if (data) setLogs(data as ImportLog[]);
    setLoadingLogs(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    Papa.parse(f, {
      header: true,
      preview: 5,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.meta.fields) setHeaders(res.meta.fields);
        setPreview(res.data as Record<string, string>[]);
      },
    });
  };

  const handleImport = async () => {
    if (!file || !user) return;
    setImporting(true);
    setResult(null);

    try {
      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
        });
      });

      const rows = parsed.data;
      let processed = 0;
      let skipped = 0;
      const newRetailers = new Set<string>();
      const updRetailers = new Set<string>();
      const newMonths = new Set<string>();
      const updMonths = new Set<string>();

      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        for (const row of batch) {
          const retailerId = row.retailer_id?.trim();
          const month = row.month?.trim();
          const branch = row.branch?.trim();
          if (!retailerId || !month || !branch || branch === 'EUROPEAN AGENCY') {
            skipped++;
            continue;
          }

          const { data: existing } = await supabase
            .from('retailer_summary')
            .select('retailer_id')
            .eq('retailer_id', retailerId)
            .maybeSingle();

          const numericFields = {
            ga_cnt: parseFloat(row.ga_cnt) || 0,
            pi_l6: parseFloat(row.pi_l6) || 0,
            pi_g6: parseFloat(row.pi_g6) || 0,
            np_l6: parseFloat(row.np_l6) || 0,
            np_g6: parseFloat(row.np_g6) || 0,
            port_in: parseFloat(row.port_in) || 0,
            port_out: parseFloat(row.port_out) || 0,
            po_deduction: parseFloat(row.po_deduction) || 0,
            clawback: parseFloat(row.clawback) || 0,
            renewal_impact: parseFloat(row.renewal_impact) || 0,
            total_ded: parseFloat(row.total_ded) || 0,
            pi_raw: parseFloat(row.pi_raw) || 0,
            add_gara: parseFloat(row.add_gara) || 0,
            pi_total: parseFloat(row.pi_total) || 0,
            incentive: parseFloat(row.incentive) || 0,
            renewal_rate: parseFloat(row.renewal_rate) || 0,
          };

          if (!existing) {
            await supabase.from('retailer_summary').insert({
              retailer_id: retailerId,
              branch,
              zone: row.zone || '',
              ...numericFields,
              total_deductions: numericFields.total_ded,
            });
            newRetailers.add(retailerId);
          } else {
            updRetailers.add(retailerId);
          }

          const { data: existingMonth } = await supabase
            .from('retailer_monthly')
            .select('id')
            .eq('retailer_id', retailerId)
            .eq('month', month)
            .maybeSingle();

          if (existingMonth) {
            await supabase
              .from('retailer_monthly')
              .update({ branch, ...numericFields })
              .eq('id', existingMonth.id);
            updMonths.add(month);
          } else {
            await supabase.from('retailer_monthly').insert({
              retailer_id: retailerId, branch, month, ...numericFields,
            });
            newMonths.add(month);
          }

          processed++;
        }
      }

      await supabase.from('import_log').insert({
        filename: file.name,
        imported_by: user.id,
        rows_processed: processed,
        rows_skipped: skipped,
        new_retailers: newRetailers.size,
        upd_retailers: updRetailers.size,
        new_months: [...newMonths],
        upd_months: [...updMonths],
        status: skipped > 0 ? 'partial' : 'success',
        error_msg: skipped > 0 ? `${skipped} rows skipped (missing required fields)` : null,
      });

      setResult({
        status: skipped > 0 ? 'partial' : 'success',
        message: `Processed ${processed} rows. ${skipped > 0 ? `${skipped} skipped.` : ''} ${newRetailers.size} new retailers, ${updRetailers.size} updated.`,
      });
      loadImportLogs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResult({ status: 'failed', message: msg });
      await supabase.from('import_log').insert({
        filename: file.name, imported_by: user.id,
        rows_processed: 0, rows_skipped: 0,
        new_retailers: 0, upd_retailers: 0,
        new_months: [], upd_months: [],
        status: 'failed', error_msg: msg,
      });
    }
    setImporting(false);
  };

  const clearFile = () => {
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#21264E]">Data Import</h2>
        <p className="text-sm text-gray-500 mt-1">Upload CSV files to import retailer performance data</p>
      </div>

      {/* Upload area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#21264E] mb-4 flex items-center gap-2">
          <Upload size={16} className="text-[#245bc1]" />
          Upload CSV File
        </h3>

        {!file ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-10 cursor-pointer hover:border-[#245bc1] hover:bg-[#245bc1]/5 transition">
            <Upload size={40} className="text-gray-300 mb-3" />
            <span className="text-sm font-medium text-[#21264E]">Click to upload or drag &amp; drop</span>
            <span className="text-xs text-gray-400 mt-1">CSV files only</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        ) : (
          <div>
            <div className="flex items-center justify-between bg-[#fff7f2] rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <FileText size={24} className="text-[#21264E]" />
                <div>
                  <p className="text-sm font-medium text-[#21264E]">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB · {headers.length} columns · {preview.length} preview rows</p>
                </div>
              </div>
              <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition">
                <X size={20} />
              </button>
            </div>

            {/* Column preview */}
            {headers.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 mb-2">Detected columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {headers.map(h => (
                    <span key={h} className="text-xs bg-[#21264E]/5 text-[#21264E] px-2 py-1 rounded-md font-mono">{h}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Data preview table */}
            {preview.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {headers.slice(0, 10).map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[#21264E] font-semibold whitespace-nowrap">{h}</th>
                      ))}
                      {headers.length > 10 && <th className="text-left py-2 px-3 text-gray-400">+{headers.length - 10} more</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        {headers.slice(0, 10).map(h => (
                          <td key={h} className="py-2 px-3 text-gray-600 whitespace-nowrap">{row[h] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Import button */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#21264E] hover:bg-[#245bc1] text-white font-medium rounded-lg transition disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Start Import
                  </>
                )}
              </button>
              <button onClick={clearFile} className="px-4 py-2.5 text-sm text-gray-500 hover:text-[#21264E] transition">
                Cancel
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                result.status === 'success' ? 'bg-green-50 border border-green-200 text-green-700' :
                result.status === 'partial' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {result.status === 'success' ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" /> :
                 <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
                <span>{result.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import History */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#21264E] flex items-center gap-2">
            <Clock size={16} className="text-[#245bc1]" />
            Import History
          </h3>
          <button
            onClick={loadImportLogs}
            className="text-xs text-gray-400 hover:text-[#21264E] flex items-center gap-1 transition"
          >
            <RotateCcw size={12} />
            Refresh
          </button>
        </div>

        {loadingLogs ? (
          <div className="text-center py-8 text-gray-400 text-sm">Loading history...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No import history yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">File</th>
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">Date</th>
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">Status</th>
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">Rows</th>
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">New/Updated</th>
                  <th className="py-2 px-3 text-[#21264E] font-semibold text-xs">Months</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-[#fff7f2] transition">
                    <td className="py-2.5 px-3 font-mono text-xs text-[#21264E]">{log.filename}</td>
                    <td className="py-2.5 px-3 text-xs text-gray-500">
                      {new Date(log.imported_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        log.status === 'success' ? 'bg-green-100 text-green-700' :
                        log.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.status === 'success' ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">
                      {log.rows_processed} processed{log.rows_skipped > 0 ? `, ${log.rows_skipped} skipped` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-600">
                      {log.new_retailers > 0 && <span className="text-[#08DC7D] font-medium">{log.new_retailers} new</span>}
                      {log.new_retailers > 0 && log.upd_retailers > 0 && ' · '}
                      {log.upd_retailers > 0 && <span className="text-[#006AE0] font-medium">{log.upd_retailers} updated</span>}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">
                      {[...log.new_months, ...log.upd_months].slice(0, 3).join(', ')}
                      {[...log.new_months, ...log.upd_months].length > 3 && '...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expected format */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-sm font-semibold text-[#21264E] mb-3 flex items-center gap-2">
          <FileText size={16} className="text-[#245bc1]" />
          Expected CSV Format
        </h3>
        <div className="overflow-x-auto">
          <div className="flex flex-wrap gap-1.5">
            {['retailer_id', 'branch', 'zone', 'month', 'ga_cnt', 'pi_l6', 'pi_g6', 'np_l6', 'np_g6',
              'port_in', 'port_out', 'po_deduction', 'clawback', 'renewal_impact', 'total_ded',
              'pi_raw', 'add_gara', 'pi_total', 'incentive', 'renewal_rate'].map(col => (
              <span key={col} className="text-xs bg-[#21264E]/5 text-[#21264E] px-2.5 py-1.5 rounded-md font-mono">{col}</span>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Month format: YYYY-MM (e.g., 2024-01). Required columns: retailer_id, branch, month.
        </p>
      </div>
    </div>
  );
}

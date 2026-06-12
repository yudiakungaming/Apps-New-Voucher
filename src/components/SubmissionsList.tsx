import React, { useState, useMemo } from 'react';
import { Submission } from '../types';
import { formatRupiah, formatDateIndonesian } from '../utils';
import { Search, Eye, Edit2, Trash2, Calendar, MapPin, DollarSign, Plus, Copy, RefreshCw, Cloud, FileText, Database } from 'lucide-react';

interface SubmissionsListProps {
  submissions: Submission[];
  onSelect: (submission: Submission) => void;
  onEdit: (submission: Submission) => void;
  onDelete: (id: string) => void;
  onDuplicate: (submission: Submission) => void;
  onAddNew: () => void;
  onOpenBuktiTransfer?: () => void;
}

export const SubmissionsList: React.FC<SubmissionsListProps> = ({
  submissions,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onAddNew,
  onOpenBuktiTransfer,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [jenisFilter, setJenisFilter] = useState<string>('');
  
  const [layoutMode, setLayoutMode] = useState<'standard' | 'spreadsheet'>('standard');
  const [activeSheetTab, setActiveSheetTab] = useState<string>('Data Sinkron');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Helper to extract item texts as a concatenated string (Isi Invoice)
  const getIsiInvoice = (sub: Submission) => {
    if (!sub.items || sub.items.length === 0) {
      return sub.notes || 'Tidak ada detil items';
    }
    return sub.items.map(item => item.item).filter(Boolean).join(', ');
  };

  // Extract dynamic monthly sheets represented in submissions
  const availableSheets = useMemo(() => {
    const sheets = ['Data Sinkron'];
    const months = new Set<string>();
    submissions.forEach(sub => {
      if (sub.tanggal) {
        const parts = sub.tanggal.split('-');
        if (parts.length >= 2) {
          months.add(`${parts[0]}-${parts[1]}`); // e.g., "2026-06"
        }
      }
    });
    // Sort months descending (latest first)
    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));
    sortedMonths.forEach(m => {
      sheets.push(`PT Nusantara Mineral Sukses Abadi-${m}`);
    });
    return sheets;
  }, [submissions]);

  // Filter logic
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchSearch =
        sub.dibayarkanKepada.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.jenisPengajuan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.lokasi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.items.some((item) => item.item.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchMethod = methodFilter === 'All' || sub.dibayarkanDengan === methodFilter;
      const subStatus = sub.status || (sub.dibayarkanDengan === 'Cek/Transfer' ? 'Lunas' : 'Belum Lunas');
      const matchStatus = statusFilter === 'All' || subStatus === statusFilter;
      const matchJenis = !jenisFilter.trim() || 
        sub.jenisPengajuan.toLowerCase().includes(jenisFilter.trim().toLowerCase());

      return matchSearch && matchMethod && matchStatus && matchJenis;
    });
  }, [submissions, searchTerm, methodFilter, statusFilter, jenisFilter]);

  const spreadsheetFilteredSubmissions = useMemo(() => {
    if (activeSheetTab === 'Data Sinkron') {
      return filteredSubmissions;
    }
    const prefix = 'PT Nusantara Mineral Sukses Abadi-';
    if (activeSheetTab.startsWith(prefix)) {
      const yearMonth = activeSheetTab.substring(prefix.length);
      return filteredSubmissions.filter(sub => sub.tanggal && sub.tanggal.startsWith(yearMonth));
    }
    return filteredSubmissions;
  }, [filteredSubmissions, activeSheetTab]);

  const spreadsheetSum = useMemo(() => {
    return spreadsheetFilteredSubmissions.reduce((sum, sub) => {
      const subSum = sub.items.reduce((itemSum, item) => itemSum + item.total, 0);
      return sum + subSum;
    }, 0);
  }, [spreadsheetFilteredSubmissions]);

  // Statistics
  const stats = useMemo(() => {
    const totalCount = filteredSubmissions.length;
    const totalAmount = filteredSubmissions.reduce((sum, sub) => {
      const subSum = sub.items.reduce((itemSum, item) => itemSum + item.total, 0);
      return sum + subSum;
    }, 0);

    const locationsCount = new Set(filteredSubmissions.map((s) => s.lokasi)).size;

    return {
      totalCount,
      totalAmount,
      locationsCount,
    };
  }, [filteredSubmissions]);

  // Grouped amounts for quick charts/budget
  const methodStats = useMemo(() => {
    let tunai = 0;
    let transfer = 0;
    filteredSubmissions.forEach(sub => {
      const subSum = sub.items.reduce((itemSum, item) => itemSum + item.total, 0);
      if (sub.dibayarkanDengan === 'Tunai') tunai += subSum;
      else transfer += subSum;
    });
    return { tunai, transfer };
  }, [filteredSubmissions]);

  return (
    <div className="space-y-6">
      {/* Dynamic View Layout Switcher Bar */}
      <div className="bg-white border border-stone-250 rounded-2xl p-2 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-3xs">
        <div className="flex items-center gap-1.5 p-0.5 bg-stone-50 rounded-xl border border-stone-100">
          <button
            onClick={() => setLayoutMode('standard')}
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              layoutMode === 'standard'
                ? 'bg-stone-900 text-white shadow-xs font-black'
                : 'bg-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-150/50'
            }`}
          >
            <Database size={13} className={layoutMode === 'standard' ? 'text-[#D4AF37]' : ''} />
            <span>Tampilan Standar (Metrik & List)</span>
          </button>
          
          <button
            onClick={() => {
              setLayoutMode('spreadsheet');
              setActiveSheetTab('Data Sinkron');
            }}
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              layoutMode === 'spreadsheet'
                ? 'bg-emerald-700 text-white shadow-xs font-black'
                : 'bg-transparent text-stone-500 hover:text-emerald-700 hover:bg-emerald-50/40'
            }`}
          >
            <FileText size={13} className={layoutMode === 'spreadsheet' ? 'text-white' : ''} />
            <span>Tampilan Spreadsheet (Excel / Google Sheets)</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2 text-right pr-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono font-bold text-stone-400">
            Internal Ledger Database: <span className="text-emerald-600 font-sans font-black">TERKONEKSI SINKRON</span>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      {layoutMode === 'standard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-[#1C1C1E] text-white p-5 rounded-2xl shadow-sm border border-neutral-800 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-stone-400 font-mono tracking-wider uppercase">Total Pengajuan</span>
              <div className="text-3xl font-bold font-sans tracking-tight">{stats.totalCount} <span className="text-sm font-normal text-stone-400">Data</span></div>
            </div>
            <div className="p-3 bg-neutral-800 rounded-xl text-amber-500">
              <Calendar size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-250 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-stone-500 font-mono tracking-wider uppercase">Total Nilai Kas keluar</span>
              <div className="text-2xl font-bold text-stone-900 font-mono tracking-tight">Rp {formatRupiah(stats.totalAmount)}</div>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl text-stone-700">
              <DollarSign size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-250 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-stone-500 font-mono tracking-wider uppercase">Klasifikasi Pembayaran</span>
              <div className="text-xs space-y-1 font-mono">
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Tunai:</span>
                  <span className="font-semibold text-stone-800">Rp {formatRupiah(methodStats.tunai)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Cek / Transfer:</span>
                  <span className="font-semibold text-stone-800">Rp {formatRupiah(methodStats.transfer)}</span>
                </div>
              </div>
            </div>
            <div className="p-3 bg-stone-100 rounded-xl text-stone-750">
              <MapPin size={22} />
            </div>
          </div>
        </div>
      )}

      {/* Control Panel: Search & Filters */}
      <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex-1 flex flex-col md:flex-row items-stretch gap-3">
          {/* Text Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder="Cari penerima, items, lokasi, atau kode..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Jenis Filter Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-stone-400" size={18} />
            <input
              type="text"
              placeholder="Filter jenis pengajuan (e.g. Petty Cash, Gaji)..."
              className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 transition"
              value={jenisFilter}
              onChange={(e) => setJenisFilter(e.target.value)}
            />
          </div>

          {/* Method Filter */}
          <select
            className="px-4 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:ring-2 focus:ring-stone-400 focus:outline-none md:w-48 text-stone-700"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="All">Semua Metode</option>
            <option value="Tunai">Tunai</option>
            <option value="Cek/Transfer">Cek/Transfer</option>
          </select>

          {/* Status Filter */}
          <select
            className="px-4 py-2.5 bg-stone-50 border border-stone-250 rounded-xl text-sm focus:ring-2 focus:ring-stone-400 focus:outline-none md:w-48 text-stone-700"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">Semua Status</option>
            <option value="Lunas">Lunas</option>
            <option value="Belum Lunas">Belum Lunas</option>
          </select>
        </div>

        {/* Action Button Container */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
          <button
            onClick={onOpenBuktiTransfer}
            id="btn-upload-bukti-transfer"
            className="flex items-center justify-center gap-1 px-4 py-2.5 border border-stone-250 bg-white hover:bg-stone-50 hover:border-stone-400 text-stone-700 font-bold rounded-xl transition shadow-3xs cursor-pointer text-xs"
          >
            <RefreshCw size={14} className="text-amber-500 mr-1" />
            <span>Upload Bukti Bayar</span>
          </button>

          <button
            onClick={onAddNew}
            id="btn-add-new-submission"
            className="flex items-center justify-center gap-2 bg-[#D4AF37] hover:bg-[#Bca031] text-stone-900 font-bold px-5 py-2.5 rounded-xl transition shadow-xs focus:ring-2 focus:ring-amber-300 cursor-pointer text-xs"
          >
            <Plus size={16} />
            <span>Input Pengajuan Baru</span>
          </button>
        </div>
      </div>

      {/* Main Content Layout Block: Standard List vs Google Sheets Simulator */}
      {layoutMode === 'standard' ? (
        /* Standard Table View */
        <div className="bg-white rounded-2xl border border-stone-250 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-mono text-xs uppercase tracking-wider">
                  <th className="py-4 px-6 font-medium">Tanggal</th>
                  <th className="py-4 px-6 font-medium">Lokasi & Kode</th>
                  <th className="py-4 px-6 font-medium">Jenis Pengajuan</th>
                  <th className="py-4 px-6 font-medium">Penerima Kas</th>
                  <th className="py-4 px-6 font-medium text-right">Total Nilai</th>
                  <th className="py-4 px-6 font-medium text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-stone-800 text-sm">
                {filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((sub) => {
                    const subTotal = sub.items.reduce((sum, i) => sum + i.total, 0);
                    return (
                      <tr key={sub.id} className="hover:bg-stone-50/50 transition">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="font-medium text-stone-900">
                            {formatDateIndonesian(sub.tanggal)}
                          </div>
                          <div className="text-xs text-stone-400 font-mono mt-0.5">{sub.tanggal}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-medium text-stone-850 flex items-center gap-1">
                            <MapPin size={13} className="text-stone-400" />
                            {sub.lokasi}
                          </div>
                          <span className="inline-block mt-1 font-mono text-xs bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                            Kode: {sub.kode}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-medium text-stone-900">{sub.jenisPengajuan}</div>
                          <div className="text-xs text-stone-500 mt-0.5 font-mono">
                            {sub.items.length} Item pengeluaran
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-stone-900">{sub.dibayarkanKepada}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              sub.dibayarkanDengan === 'Tunai'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}>
                              {sub.dibayarkanDengan}
                            </span>
                            
                            <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              (sub.status || (sub.dibayarkanDengan === 'Cek/Transfer' ? 'Lunas' : 'Belum Lunas')) === 'Lunas'
                                ? 'bg-teal-50 text-teal-700 border border-teal-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-100'
                            }`}>
                              {sub.status || (sub.dibayarkanDengan === 'Cek/Transfer' ? 'Lunas' : 'Belum Lunas')}
                            </span>

                            {sub.googleDriveFileUrl && (
                              <a
                                href={sub.googleDriveFileUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={`Lampiran: ${sub.googleDriveFileName || 'Buka di Drive'}`}
                                className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full hover:bg-amber-100 transition font-mono font-bold"
                              >
                                <Cloud size={10} className="text-amber-600" />
                                Drive
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-semibold text-stone-900">
                          Rp {formatRupiah(subTotal)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              title="Tampilkan / Cetak PDF"
                              onClick={() => onSelect(sub)}
                              id={`btn-view-${sub.id}`}
                              className="p-1.5 hover:bg-stone-100 text-[#D4AF37] hover:text-[#Bca031] rounded-lg transition"
                            >
                              <Eye size={17} />
                            </button>
                            
                            <button
                              title="Duplikat Data"
                              onClick={() => onDuplicate(sub)}
                              id={`btn-dup-${sub.id}`}
                              className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg transition"
                            >
                              <Copy size={16} />
                            </button>

                            <button
                              title="Edit Data"
                              onClick={() => onEdit(sub)}
                              id={`btn-edit-${sub.id}`}
                              className="p-1.5 hover:bg-stone-100 text-sky-500 hover:text-sky-700 rounded-lg transition"
                            >
                              <Edit2 size={16} />
                            </button>

                            <button
                              title="Hapus Data"
                              onClick={() => {
                                if (window.confirm(`Yakin ingin menghapus data pengajuan untuk "${sub.dibayarkanKepada}" senilai Rp ${formatRupiah(subTotal)}?`)) {
                                  onDelete(sub.id);
                                }
                              }}
                              id={`btn-delete-${sub.id}`}
                              className="p-1.5 hover:bg-stone-100 text-rose-500 hover:text-rose-700 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-400">
                      Tidak ditemukan data pengajuan yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Google Sheets Table Simulator View with tabs & sum status */
        <div className="bg-[#f9fbfd] rounded-2xl border border-stone-300 shadow-sm overflow-hidden flex flex-col font-sans select-none animate-fade-in">
          {/* Google Sheets Header & Topbar */}
          <div className="bg-emerald-800 text-white p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white text-emerald-800 rounded-lg shadow-sm">
                <FileText size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-white">Pembuatan Voucher NMSA</span>
                  <span className="text-[10px] bg-emerald-700/80 text-emerald-100 px-1.5 py-0.2 rounded font-mono">Disinkronisasi</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-[10.5px] text-emerald-200 mt-0.5">
                  <span className="hover:text-white cursor-pointer transition">File</span>
                  <span className="hover:text-white cursor-pointer transition">Edit</span>
                  <span className="hover:text-white cursor-pointer transition">Tampilan</span>
                  <span className="hover:text-white cursor-pointer transition">Format</span>
                  <span className="hover:text-white cursor-pointer transition">Data</span>
                  <span className="hover:text-white cursor-pointer transition">Alat</span>
                  <span className="hover:text-white cursor-pointer transition">Bantuan</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Quick action with selected row */}
              {selectedRowId && (() => {
                const selectedSub = submissions.find(s => s.id === selectedRowId);
                if (!selectedSub) return null;
                const subTotal = selectedSub.items.reduce((sum, i) => sum + i.total, 0);
                return (
                  <div className="bg-emerald-900/80 border border-emerald-600 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                    <span className="text-emerald-300">Baris Terpilih: <strong className="text-white font-mono">{selectedSub.kode || 'Voucher'}</strong></span>
                    <div className="h-4 w-[1px] bg-emerald-700"></div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onSelect(selectedSub)}
                        className="p-1 hover:bg-emerald-850 text-amber-400 hover:text-amber-300 rounded cursor-pointer transition"
                        title="Lihat / Cetak Voucher"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => onEdit(selectedSub)}
                        className="p-1 hover:bg-emerald-850 text-sky-400 hover:text-sky-300 rounded cursor-pointer transition"
                        title="Edit Voucher"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDuplicate(selectedSub)}
                        className="p-1 hover:bg-emerald-850 text-stone-300 hover:text-white rounded cursor-pointer transition"
                        title="Duplikat Voucher"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Yakin ingin menghapus voucher "${selectedSub.dibayarkanKepada}" senilai Rp ${formatRupiah(subTotal)}?`)) {
                            onDelete(selectedSub.id);
                            setSelectedRowId(null);
                          }
                        }}
                        className="p-1 hover:bg-emerald-850 text-rose-400 hover:text-rose-300 rounded cursor-pointer transition"
                        title="Hapus Voucher"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })()}
              
              <button
                onClick={onAddNew}
                className="bg-white hover:bg-stone-100 text-emerald-850 font-black text-xs px-4 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Tambah Baris</span>
              </button>
            </div>
          </div>

          {/* Google Sheets Decorative Menu Formatter Bar */}
          <div className="bg-stone-50 border-b border-stone-200 p-1.5 flex flex-wrap items-center gap-1 text-xs text-stone-600">
            <div className="px-2 py-1 bg-white border border-stone-200 rounded text-[11px] font-medium text-stone-700 min-w-[70px] text-center">
              Arial
            </div>
            <div className="h-4 w-[1px] bg-stone-300 mx-1"></div>
            <div className="px-2 py-1 bg-white border border-stone-200 rounded text-[11px] font-medium text-stone-700 text-center">
              100%
            </div>
            <div className="h-4 w-[1px] bg-stone-300 mx-1"></div>
            <button className="p-1 hover:bg-stone-200 rounded font-bold font-mono">Rp</button>
            <button className="p-1 hover:bg-stone-200 rounded font-bold font-mono">%</button>
            <button className="p-1 hover:bg-stone-200 rounded font-mono">.0</button>
            <button className="p-1 hover:bg-stone-200 rounded font-mono">.00</button>
            <div className="h-4 w-[1px] bg-stone-300 mx-1"></div>
            <button className="p-1 bg-stone-200/50 text-stone-800 rounded">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
              </svg>
            </button>
            <div className="h-4 w-[1px] bg-stone-300 mx-1"></div>
            <div className="flex-1 text-right text-[10.5px] font-mono text-stone-400 pr-2">
              Double klik baris untuk cetak bukti PDF
            </div>
          </div>

          {/* Dense Table wrapper */}
          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-left border-collapse table-fixed select-text">
              <thead>
                {/* Spreadsheet Column Label Coordinates (A, B, C...) */}
                <tr className="bg-stone-100 text-stone-500 font-mono text-[10px] uppercase text-center border-b border-stone-250">
                  <th className="w-10 bg-stone-200/60 border-r border-stone-250 py-1"></th>
                  <th className="w-12 border-r border-stone-250 py-1">A</th>
                  <th className="w-48 border-r border-stone-250 py-1">B</th>
                  <th className="w-28 border-r border-stone-250 py-1">C</th>
                  <th className="w-48 border-r border-stone-250 py-1">D</th>
                  <th className="w-36 border-r border-stone-250 py-1">E</th>
                  <th className="w-64 border-r border-stone-250 py-1">F</th>
                  <th className="w-32 border-r border-stone-250 py-1">G</th>
                  <th className="w-24 border-r border-stone-250 py-1">H</th>
                  <th className="w-44 border-r border-stone-250 py-1">I</th>
                  <th className="w-20 border-r border-stone-250 py-1">J</th>
                  <th className="w-36 border-r border-stone-250 py-1">K</th>
                  <th className="w-24 bg-stone-105 border-stone-250 py-1">Aksi</th>
                </tr>
                {/* Actual Labels Row (No, Company, Tanggal...) */}
                <tr className="bg-stone-50 border-b border-stone-300 text-stone-600 font-bold text-[11px] tracking-tight">
                  <th className="bg-stone-100 border-r border-stone-300 text-center py-2 text-stone-400 font-mono text-[10px]">#</th>
                  <th className="border-r border-stone-300 px-2 py-2">No</th>
                  <th className="border-r border-stone-300 px-2.5 py-2">Company</th>
                  <th className="border-r border-stone-300 px-2 py-2">Tanggal</th>
                  <th className="border-r border-stone-300 px-2 py-2">No Invoice</th>
                  <th className="border-r border-stone-300 px-2 py-2">Jenis</th>
                  <th className="border-r border-stone-300 px-2.5 py-2">Isi Invoice</th>
                  <th className="border-r border-stone-300 px-2.5 py-2 text-right">Nominal</th>
                  <th className="border-r border-stone-300 px-2 py-2 text-center">Status</th>
                  <th className="border-r border-stone-300 px-2.5 py-2">Dibayarkan</th>
                  <th className="border-r border-stone-300 px-2 py-2 text-center">Link File</th>
                  <th className="border-r border-stone-300 px-2 py-2">Nama File</th>
                  <th className="px-2 py-2 text-center bg-stone-100/50">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-800 text-[11px] font-sans">
                {spreadsheetFilteredSubmissions.length > 0 ? (
                  spreadsheetFilteredSubmissions.map((sub, idx) => {
                    const subTotal = sub.items.reduce((sum, i) => sum + i.total, 0);
                    const isSelected = selectedRowId === sub.id;
                    const itemDescription = getIsiInvoice(sub);
                    
                    return (
                      <tr 
                        key={sub.id} 
                        onClick={() => setSelectedRowId(sub.id)}
                        onDoubleClick={() => onSelect(sub)}
                        className={`hover:bg-amber-50/20 active:bg-amber-100/35 transition-colors cursor-pointer ${
                          isSelected ? 'bg-emerald-50/60 font-medium border-l-2 border-emerald-600' : 'bg-white'
                        }`}
                      >
                        {/* Left vertical numbers list indicator */}
                        <td className={`font-mono text-[10px] text-center select-none border-r border-stone-300 font-bold ${
                          isSelected ? 'bg-emerald-700 text-white' : 'bg-stone-50 text-stone-400'
                        }`}>
                          {idx + 1}
                        </td>
                        
                        {/* Column A: No */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 font-mono text-center">
                          {idx + 1}
                        </td>
                        
                        {/* Column B: Company */}
                        <td className="border-r border-stone-200/80 px-2.5 py-1.5 truncate max-w-full" title="PT Nusantara Mineral Sukses Abadi">
                          PT Nusantara Mineral Sukses Abadi
                        </td>
                        
                        {/* Column C: Tanggal */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 whitespace-nowrap text-stone-700">
                          {formatDateIndonesian(sub.tanggal)}
                        </td>
                        
                        {/* Column D: No Invoice */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 font-mono font-bold text-stone-900 truncate">
                          {sub.kode || 'BKK-VOUCHER'}
                        </td>
                        
                        {/* Column E: Jenis */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 truncate" title={sub.jenisPengajuan}>
                          {sub.jenisPengajuan}
                        </td>
                        
                        {/* Column F: Isi Invoice */}
                        <td className="border-r border-stone-200/80 px-2.5 py-1.5 text-stone-600 max-w-xs truncate" title={itemDescription}>
                          {itemDescription}
                        </td>
                        
                        {/* Column G: Nominal */}
                        <td className="border-r border-stone-200/80 px-2.5 py-1.5 text-right font-mono font-bold text-emerald-800">
                          Rp {formatRupiah(subTotal)}
                        </td>
                        
                        {/* Column H: Status */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 text-center">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            (sub.status || (sub.dibayarkanDengan === 'Cek/Transfer' ? 'Lunas' : 'Belum Lunas')) === 'Lunas'
                              ? 'bg-emerald-100 text-emerald-850 font-extrabold uppercase border border-emerald-350'
                              : 'bg-rose-100 text-rose-850 font-extrabold uppercase border border-rose-350 animate-pulse'
                          }`}>
                            {sub.status || (sub.dibayarkanDengan === 'Cek/Transfer' ? 'Lunas' : 'Belum Lunas')}
                          </span>
                        </td>
                        
                        {/* Column I: Dibayarkan */}
                        <td className="border-r border-stone-200/80 px-2.5 py-1.5 font-medium truncate" title={sub.dibayarkanKepada}>
                          {sub.dibayarkanKepada}
                        </td>
                        
                        {/* Column J: Link File (Google Drive) */}
                        <td className="border-r border-stone-200/80 px-2 py-1.5 text-center">
                          {sub.googleDriveFileUrl ? (
                            <a
                              href={sub.googleDriveFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 text-[#a58421] border border-amber-300 px-1.5 py-0.5 rounded font-mono font-black shadow-3xs"
                              title={sub.googleDriveFileName || "Buka Lampiran Drive"}
                            >
                              <Cloud size={10} className="text-amber-500" />
                              Drive
                            </a>
                          ) : (
                            <span className="text-stone-300 font-mono">-</span>
                          )}
                        </td>
                        
                        {/* Column K: Nama File */}
                        <td className="border-r border-stone-200/80 px-2 py-1 flex items-center h-full max-w-xs overflow-x-auto scrollbar-none" title={sub.googleDriveFileName || 'Tidak ada file lampiran'}>
                          {sub.googleDriveFiles && sub.googleDriveFiles.some(f => f.docType) ? (
                            <div className="flex flex-wrap gap-1 items-center py-0.5">
                              {sub.googleDriveFiles.filter(f => f.docType).map((f) => {
                                const docAbbrev = f.docType === 'po' ? 'PO'
                                                : f.docType === 'lhv' ? 'LHV'
                                                : f.docType === 'draft_survei' ? 'Survei'
                                                : f.docType === 'bill_of_lading' ? 'B/L'
                                                : f.docType === 'cargo_manifest' ? 'Cargo'
                                                : f.docType === 'cow_coa_ds_bongkar' ? 'COW/COA'
                                                : f.docType === 'bukti_pembayaran_batubara' ? 'P.Bara'
                                                : f.docType === 'bukti_shipment_tongkang_founder' ? 'S.Tongkang'
                                                : f.docType === 'bukti_pajak_trader_founder' ? 'Pajak'
                                                : f.docType === 'merged_all' ? 'Gabungan'
                                                : f.docType?.toUpperCase();
                                return (
                                  <a
                                    key={f.docType}
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`border text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0 transition ${
                                      f.docType === 'merged_all'
                                        ? 'bg-amber-50 hover:bg-amber-100 text-[#917118] border-amber-250'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-250'
                                    }`}
                                    title={`Buka ${f.name}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {docAbbrev}
                                  </a>
                                );
                              })}
                              {sub.googleDriveFiles.some(f => !f.docType && !f.isF1 && !f.isF2 && !f.isBuktiPembayaran) && (
                                <span className="bg-stone-50 text-stone-600 border border-stone-250 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase shrink-0">
                                  +{sub.googleDriveFiles.filter(f => !f.docType && !f.isF1 && !f.isF2 && !f.isBuktiPembayaran).length}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="truncate block py-0.5" title={sub.googleDriveFileName || ''}>
                              {sub.googleDriveFileName || '-'}
                            </span>
                          )}
                        </td>
                        
                        {/* Action buttons inside rows */}
                        <td className="px-2 py-1.5 text-center bg-stone-50/50">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="Tampilkan / Cetak PDF"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(sub);
                              }}
                              className="p-1 hover:bg-stone-255 hover:bg-stone-200/80 text-[#D4AF37] rounded transition"
                            >
                              <Eye size={12} />
                            </button>
                            
                            <button
                              title="Edit Data"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(sub);
                              }}
                              className="p-1 hover:bg-stone-255 hover:bg-stone-200/80 text-sky-500 rounded transition"
                            >
                              <Edit2 size={12} />
                            </button>
                            
                            <button
                              title="Hapus Data"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Yakin ingin menghapus data pengajuan untuk "${sub.dibayarkanKepada}" senilai Rp ${formatRupiah(subTotal)}?`)) {
                                  onDelete(sub.id);
                                }
                              }}
                              className="p-1 hover:bg-stone-255 hover:bg-stone-200/80 text-rose-500 rounded transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-stone-400 font-mono text-xs">
                      Tidak ditemukan data transaksi yang terdaftar di halaman filter ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* BOTTOM GOOGLE SHEETS TABS */}
          <div className="bg-stone-100 border-t border-stone-300 flex flex-col sm:flex-row sm:items-center justify-between text-xs px-2 select-none h-auto sm:h-11">
            {/* Tabs flow container */}
            <div className="flex flex-wrap items-end h-full gap-0.5 overflow-x-auto scroller-hidden">
              {/* Quick left controls (like spreadsheet) */}
              <div className="flex items-center gap-1 px-2 text-stone-500 border-r border-stone-300 h-9 shrink-0">
                <button 
                  onClick={() => onAddNew()}
                  className="p-1 hover:bg-stone-200 rounded text-stone-700 cursor-pointer text-xs font-black"
                  title="Input Voucher Baru"
                >
                  +
                </button>
                <div className="h-4 w-[1px] bg-stone-300 mx-0.5"></div>
                <span className="text-[10px] font-mono select-none">Halaman {spreadsheetFilteredSubmissions.length} baris</span>
              </div>
              
              {/* Direct tabs */}
              {availableSheets.map((sheet) => {
                const isActive = activeSheetTab === sheet;
                // Clean description label
                let label = sheet;
                if (sheet === 'Data Sinkron') {
                  label = '📊 Data Sinkron';
                } else {
                  // Shorten tab label to match Google Sheet: "NMSA-2026-06"
                  label = sheet.replace('PT Nusantara Mineral Sukses Abadi-', '📁 NMSA-');
                }
                
                return (
                  <button
                    key={sheet}
                    onClick={() => setActiveSheetTab(sheet)}
                    className={`px-4 py-2 font-bold text-[11px] rounded-t-lg border-t-3 transition duration-150 cursor-pointer h-9 flex items-center justify-center shrink-0 border-x border-stone-300 ${
                      isActive 
                        ? 'bg-white text-emerald-800 border-t-emerald-700 font-extrabold shadow-3xs' 
                        : 'bg-stone-50 hover:bg-stone-150 text-stone-600 border-t-transparent'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
              
              {/* Decorative dashboard redirection tab */}
              <button
                onClick={() => setLayoutMode('standard')}
                className="px-4 py-2 font-bold text-[11px] rounded-t-lg border-t-3 border-t-transparent bg-stone-50 hover:bg-stone-150 text-[#D4AF37] cursor-pointer h-9 flex items-center justify-center shrink-0 border-x border-stone-300"
              >
                🏠 KEMBALI KE METRIK DASHBOARD
              </button>
            </div>

            {/* Sum details at bottom right */}
            <div className="p-2 sm:p-0 font-mono text-[11.5px] font-bold text-stone-600 shrink-0 flex items-center gap-4 bg-stone-200/50 rounded-lg sm:bg-transparent sm:rounded-none">
              <div className="flex items-center gap-1 bg-stone-200 px-2.5 py-1 rounded">
                <span className="text-stone-400">JUMLAH BARIS:</span>
                <span className="text-stone-800">{spreadsheetFilteredSubmissions.length} Data</span>
              </div>
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-800 px-3 py-1 rounded border border-emerald-250">
                <span className="text-emerald-600 font-extrabold">SUM TOTAL:</span>
                <span className="font-extrabold">Rp {formatRupiah(spreadsheetSum)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

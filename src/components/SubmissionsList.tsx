import React, { useState, useMemo } from 'react';
import { Submission } from '../types';
import { formatRupiah, formatDateIndonesian } from '../utils';
import { Search, Eye, Edit2, Trash2, Calendar, MapPin, DollarSign, Plus, Copy, RefreshCw, Cloud } from 'lucide-react';

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
      {/* KPI Cards */}
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

      {/* Main Table */}
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
    </div>
  );
};

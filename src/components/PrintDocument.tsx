import React, { useState, useEffect } from 'react';
import { Submission } from '../types';
import { formatRupiah, formatDateIndonesian, numberToTerbilang } from '../utils';
import { NusantaraLogo } from './NusantaraLogo';
import { Printer, ArrowLeft, Layers, FileText, CheckCircle, Cloud, Loader2 } from 'lucide-react';
import { getStoredGoogleDriveToken, googleDriveLogin } from '../firebase';

interface PrintDocumentProps {
  submission: Submission;
  onBack: () => void;
  userProfile?: any;
}

const getGoogleDriveEmbedUrl = (url: string): string => {
  if (!url) return '';
  if (url.includes('/preview')) return url;
  
  const dMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return `https://drive.google.com/file/d/${dMatch[1]}/preview`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
  }
  return url;
};

export interface RenderedPage {
  id: string;
  fileName: string;
  fileIndex: number;
  pageNumber: number;
  dataUrl: string;
}

const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = () => {
      reject(new Error('Gagal memuat pustaka PDF.js'));
    };
    document.head.appendChild(script);
  });
};

export const PrintDocument: React.FC<PrintDocumentProps> = ({ submission, onBack, userProfile }) => {
  const [activeTab, setActiveTab] = useState<'both' | 'pengajuan' | 'pengeluaran' | 'lampiran'>('both');
  const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const grandTotal = submission.items.reduce((sum, item) => sum + item.total, 0);

  const billFiles = (submission.googleDriveFiles || []).filter(
    (f: any) => !f.isF1 && !f.isF2 && !f.isBuktiPembayaran
  );
  
  const legacyFiles = !submission.googleDriveFiles && submission.googleDriveFileUrl
    ? [{ url: submission.googleDriveFileUrl, name: submission.googleDriveFileName || 'Lampiran Bukti' }]
    : [];
    
  const activeBillFiles = billFiles.length > 0 ? billFiles : legacyFiles;

  const paymentProofFile = submission.buktiPembayaran || (submission.googleDriveFiles || []).find((f: any) => f.isBuktiPembayaran);
  
  const attachmentFiles = [
    ...activeBillFiles,
    ...(paymentProofFile ? [{ ...paymentProofFile, isBuktiPembayaran: true }] : [])
  ];

  // Dynamic document title based on "Jenis Pengajuan & Nomor Kode" for proper PDF download naming
  useEffect(() => {
    const originalTitle = document.title;
    if (submission) {
      const jenis = submission.jenisPengajuan || 'Pengajuan';
      const kode = submission.kode || 'Dokumen';
      const cleanTitle = `${jenis}-${kode}`
        .replace(/[\s/\\_]+/g, '-') // Replace spaces, slashes, backslashes, underscores with '-'
        .replace(/-+/g, '-')        // Collapse consecutive '-' to a single '-'
        .trim()                     // Trim leading/trailing whitespace
        .replace(/^-+|-+$/g, '');   // Trim leading/trailing dashes

      document.title = cleanTitle || originalTitle;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [submission]);

  useEffect(() => {
    if (attachmentFiles.length === 0) {
      setRenderedPages([]);
      return;
    }

    let isMounted = true;
    const processFiles = async () => {
      setIsLoadingPages(true);
      setLoadError('');
      setRenderedPages([]);

      try {
        const token = getStoredGoogleDriveToken();
        const tempPages: RenderedPage[] = [];

        for (let i = 0; i < attachmentFiles.length; i++) {
          const file = attachmentFiles[i];
          if (isMounted) {
            setLoadingProgress(`Mengunduh berkas ${i + 1} dari ${attachmentFiles.length}: ${file.name}...`);
          }

          if (file.url && (file.url.startsWith('data:') || file.url.startsWith('blob:'))) {
            tempPages.push({
              id: `direct-b64-${i}-${Date.now()}`,
              fileName: file.name,
              fileIndex: i,
              pageNumber: 1,
              dataUrl: file.url
            });
            continue;
          }

          const dMatch = file.url ? file.url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) : null;
          const idMatch = file.url ? file.url.match(/[?&]id=([a-zA-Z0-9_-]+)/) : null;
          const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);

          if (!fileId) {
            console.warn('Tidak dapat menemukan file ID untuk', file?.url);
            continue;
          }

          const isPdf = /\.pdf/i.test(file.name || '') || file.url.includes('.pdf');

          // Download file content via public export or auth media
          let fileBlob: Blob | null = null;
          try {
            const headers: HeadersInit = {};
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
            const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers });
            if (!fileRes.ok) {
              throw new Error(`HTTP ${fileRes.status}`);
            }
            fileBlob = await fileRes.blob();
          } catch (fetchErr: any) {
            console.warn('Gagal mengunduh menggunakan token, mencoba unduhan publik langsung:', fetchErr);
            if (!isPdf) {
              // Non-PDF files (images) do not need CORS-compliant binary blobs!
              // We can render them directly using the Google Drive direct uc export view URL inside img tags
              tempPages.push({
                id: `${fileId}-fallback-img`,
                fileName: file.name,
                fileIndex: i,
                pageNumber: 1,
                dataUrl: `https://docs.google.com/uc?export=view&id=${fileId}`
              });
              continue;
            }
            // Fallback to docs.google.com direct download helper
            try {
              const publicRes = await fetch(`https://docs.google.com/uc?export=download&id=${fileId}`);
              if (!publicRes.ok) {
                throw new Error('Gagal mengunduh file dari Google Drive. Pastikan berkas dapat diakses publik atau hubungkan ulang akun Google Drive.');
              }
              fileBlob = await publicRes.blob();
            } catch (pdfFallbackErr) {
              throw new Error(`Gagal mengunduh dokumen PDF dari Google Drive. Sesi koneksi Anda kemungkinan telah kedaluwarsa atau berkas tidak diatur publik.`);
            }
          }

          if (isPdf && fileBlob) {
            if (isMounted) {
              setLoadingProgress(`Membaca dokumen PDF ${file.name}...`);
            }
            const pdfjsLib = await loadPdfJs();
            const arrayBuffer = await fileBlob.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
              if (isMounted) {
                setLoadingProgress(`Merender PDF ${file.name} - Halaman ${pNum} dari ${pdf.numPages}...`);
              }
              const page = await pdf.getPage(pNum);
              // Scale carefully to render gorgeous quality and fit nicely onto standard display/print dimensions
              const viewport = page.getViewport({ scale: 1.5 });
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              if (!context) continue;

              canvas.height = viewport.height;
              canvas.width = viewport.width;

              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;

              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              tempPages.push({
                id: `${fileId}-p${pNum}`,
                fileName: file.name,
                fileIndex: i,
                pageNumber: pNum,
                dataUrl
              });
            }
          } else if (fileBlob) {
            // Treat as single-page image
            const dataUrl = URL.createObjectURL(fileBlob);
            tempPages.push({
              id: `${fileId}-img`,
              fileName: file.name,
              fileIndex: i,
              pageNumber: 1,
              dataUrl
            });
          }
        }

        if (isMounted) {
          setRenderedPages(tempPages);
        }
      } catch (err: any) {
        console.error('Failure rendering attachments:', err);
        if (isMounted) {
          setLoadError(`Gagal mempersiapkan dokumen lampiran bukti: ${err.message || err}. Silakan hubungkan ulang Google Drive Anda.`);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPages(false);
        }
      }
    };

    processFiles();

    return () => {
      isMounted = false;
    };
  }, [submission, reloadTrigger]);

  const handlePrint = () => {
    window.print();
  };

  const totalPagesCount = 2 + renderedPages.length;

  return (
    <div className="space-y-6">
      {/* Tab Controls / Print Actions */}
      <div className="p-4 bg-white rounded-2xl border border-stone-250 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            id="btn-print-back"
            className="p-1.5 hover:bg-stone-100 text-stone-500 hover:text-stone-850 rounded-lg transition"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="space-y-0.5">
            <h3 className="font-bold text-stone-900">Preview & Cetak Dokumen</h3>
            <p className="text-xs text-stone-400">Pilih format cetak di bawah dan tekan tombol cetak.</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200 flex-wrap gap-1">
          <button
            onClick={() => setActiveTab('both')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'both' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-955'
            }`}
          >
            <Layers size={13} />
            {attachmentFiles.length > 0 ? `Cetak Semua (${isLoadingPages ? '...' : totalPagesCount} Hal)` : 'Cetak Dua Halaman'}
          </button>
          <button
            onClick={() => setActiveTab('pengajuan')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'pengajuan' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-955'
            }`}
          >
            <FileText size={13} />
            Hanya Formulir Pengajuan
          </button>
          <button
            onClick={() => setActiveTab('pengeluaran')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'pengeluaran' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-550 hover:text-stone-955'
            }`}
          >
            <CheckCircle size={13} />
            Hanya Bukti Pengeluaran
          </button>
          {attachmentFiles.length > 0 && (
            <button
              onClick={() => setActiveTab('lampiran')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'lampiran' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-555 hover:text-stone-955'
              }`}
            >
              <Cloud size={13} className="text-amber-600" />
              Hanya Lampiran ({isLoadingPages ? '...' : renderedPages.length})
            </button>
          )}
        </div>

        {attachmentFiles.length > 0 && (
          <div className="flex flex-col gap-1 p-2 px-3 bg-amber-50 border border-amber-200 rounded-xl print:hidden max-w-[300px]">
            <div className="flex items-center gap-1.5">
              <Cloud size={14} className="text-[#D4AF37]" />
              <span className="font-semibold text-stone-700 text-xs">Akses Lampiran ({attachmentFiles.length} File):</span>
            </div>
            <div className="text-[11px] max-h-[60px] overflow-y-auto space-y-1">
              {attachmentFiles.map((file, i) => (
                <div key={i} className="truncate">
                  {i + 1}. <a href={file.url} target="_blank" rel="noreferrer" className="text-amber-800 hover:underline font-bold font-mono">
                    {file.name}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handlePrint}
          id="btn-print-document"
          className="flex items-center gap-2 bg-stone-900 hover:bg-stone-850 text-white font-bold px-5 py-2 rounded-xl transition"
        >
          <Printer size={16} />
          Cetak PDF / A4
        </button>
      </div>

      {/* DOCUMENT PAGE HOLDER */}
      <div className="flex flex-col items-center space-y-8 print:space-y-0 print:bg-white">
        
        {/* ================= PAGE 1: BUKTI PENGELUARAN KAS / BANK ================= */}
        {(activeTab === 'both' || activeTab === 'pengeluaran') && (
          <div className="w-[210mm] min-h-[297mm] bg-white p-[15mm] border border-stone-250 shadow-md rounded-xl print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 page-break">
            
            {/* Header Block Left (Logo) & Right (Code & Tanggal) */}
            <div className="flex justify-between items-start mb-6">
              <NusantaraLogo size="md" className="items-start text-left" companyName={userProfile?.companyName} />

              <div className="flex flex-col items-end pt-2">
                <div className="text-right text-stone-400 font-mono text-[10px] mb-1">
                  Halaman: 1 / {isLoadingPages ? '...' : totalPagesCount} (Kas/Bank)
                </div>
                {/* Double border or standard rectangular HO code box */}
                <div className="border border-black px-8 py-1.5 font-bold text-base text-black bg-stone-50 mb-2 min-w-[120px] text-center font-mono">
                  {submission.kode}
                </div>
                <div className="text-xs text-black font-semibold">
                  Tanggal : <span className="font-normal">{formatDateIndonesian(submission.tanggal)}</span>
                </div>
              </div>
            </div>

            {/* Document Title Block */}
            <div className="border-[2px] border-black bg-white py-2.5 text-center mb-6">
              <h1 className="text-sm font-bold text-black font-sans uppercase tracking-[1.5px]">
                BUKTI PENGELUARAN KAS / BANK
              </h1>
            </div>

            {/* Metadata Fields Area */}
            <div className="text-sm font-sans space-y-2 mb-6 px-1">
              <div className="grid grid-cols-[140px_10px_1fr] gap-y-3">
                <span className="font-semibold text-black">Dibayarkan Kepada</span>
                <span className="text-black">:</span>
                <span className="text-black font-bold">{submission.dibayarkanKepada}</span>

                <span className="font-semibold text-black">Jenis Pengajuan</span>
                <span className="text-black">:</span>
                <span className="text-black">{submission.jenisPengajuan}</span>

                <span className="font-semibold text-black">Kode</span>
                <span className="text-black">:</span>
                <span className="text-black font-mono">{submission.kode}</span>

                <span className="font-semibold text-black">Dibayarkan dengan</span>
                <span className="text-black">:</span>
                <div className="flex items-center gap-6">
                  {/* Tunai block check */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 border border-black flex items-center justify-center font-bold text-black bg-stone-50 font-mono">
                      {submission.dibayarkanDengan === 'Tunai' ? 'X' : ''}
                    </div>
                    <span>Tunai</span>
                  </div>

                  {/* Cek/Transfer block check */}
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 border border-black flex items-center justify-center font-bold text-black bg-stone-50 font-mono">
                      {submission.dibayarkanDengan === 'Cek/Transfer' ? 'X' : ''}
                    </div>
                    <span>Cek / Transfer</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table Voucher */}
            <div className="mb-6">
              <table className="w-full border-collapse border-[1.5px] border-black text-sm">
                <thead>
                  <tr className="bg-white border-b-[1.5px] border-black text-black font-bold uppercase text-xs">
                    <th className="border-r border-black py-2.5 px-4 text-left">JENIS PENGAJUAN</th>
                    <th className="py-2.5 px-4 text-right w-64">JUMLAH</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.items.map((item) => (
                    <tr key={item.id} className="border-b border-black text-black min-h-[70px]">
                      <td className="border-r border-black py-5 px-4 leading-relaxed font-semibold">
                        {item.item}
                      </td>
                      <td className="py-5 px-4 text-right font-mono font-bold text-base">
                        Rp <span className="float-right">{formatRupiah(item.total)}</span>
                      </td>
                    </tr>
                  ))}
                  
                  {/* Exact total spacer block like the screenshot */}
                  <tr className="border-t-[1.5px] border-black font-bold text-black">
                    <td className="border-r border-black py-2 px-4 bg-stone-50"></td>
                    <td className="py-2.5 px-4 text-right font-mono text-base font-bold bg-[#fcfcfc]">
                      Rp <span className="float-right">{formatRupiah(grandTotal)}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Terbilang block - Very professional accounting requirement */}
            <div className="border border-black p-3.5 mb-8 bg-stone-50/30 text-sm flex gap-2">
              <span className="font-bold text-black">Terbilang :</span>
              <span className="text-black italic font-medium">
                "{numberToTerbilang(grandTotal)}"
              </span>
            </div>

            {/* 4 Cells Signatures Table Grid */}
            <table className="w-full border-collapse border border-black bg-white mt-12 text-center text-xs table-fixed">
              <thead>
                <tr className="bg-stone-50 border-b border-black text-[10px] font-bold uppercase text-stone-700">
                  <th className="border-r border-black py-1.5 w-1/4">Diverifikasi</th>
                  <th className="border-r border-black py-1.5 w-1/4">Disetujui</th>
                  <th className="border-r border-black py-1.5 w-1/4">Disetujui</th>
                  <th className="py-1.5 w-1/4">Dibukukan</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: '110px' }} className="align-bottom">
                  <td className="border-r border-black py-2 px-1 pb-3 align-bottom">
                    <div className="text-black font-bold text-[11px] leading-tight uppercase truncate">{submission.diverifikasiOleh}</div>
                    <div className="text-[9px] text-stone-500 font-medium font-mono border-t border-stone-200 mt-1 pt-1 mx-2 uppercase truncate">{submission.diverifikasiJabatan}</div>
                  </td>
                  <td className="border-r border-black py-2 px-1 pb-3 align-bottom">
                    <div className="text-black font-bold text-[11px] leading-tight uppercase truncate">{submission.disetujuiOleh}</div>
                    <div className="text-[9px] text-stone-500 font-medium font-mono border-t border-stone-200 mt-1 pt-1 mx-2 uppercase text-stone-500">Dir Keuangan</div>
                  </td>
                  <td className="border-r border-black py-2 px-1 pb-3 align-bottom">
                    <div className="text-black font-bold text-[11px] leading-tight uppercase truncate">{submission.disetujuiOleh2}</div>
                    <div className="text-[9px] text-stone-500 font-medium font-mono border-t border-stone-200 mt-1 pt-1 mx-2 uppercase truncate">{submission.disetujuiJabatan2 || 'DIREKTUR'}</div>
                  </td>
                  <td className="py-2 px-1 pb-3 align-bottom">
                    <div className="text-black font-bold text-[11px] leading-tight uppercase truncate">{submission.dibukukanOleh}</div>
                    <div className="text-[9px] text-stone-500 font-medium font-mono border-t border-stone-200 mt-1 pt-1 mx-2 uppercase truncate">{submission.dibukukanJabatan}</div>
                  </td>
                </tr>
              </tbody>
            </table>



          </div>
        )}

        {/* Divider for Screen View, hidden during printing */}
        {activeTab === 'both' && (
          <div className="w-[210mm] border-t-2 border-dashed border-stone-300 py-2 print:hidden flex justify-center">
            <span className="text-xs bg-stone-100 text-stone-500 px-3 py-1 rounded-full font-semibold">BATAS HALAMAN CETAK (PAGE BREAK)</span>
          </div>
        )}

        {/* ================= PAGE 2: FORMULIR PENGAJUAN HO ================= */}
        {(activeTab === 'both' || activeTab === 'pengajuan') && (
          <div className="w-[210mm] min-h-[297mm] bg-white p-[15mm] border border-stone-250 shadow-md rounded-xl print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 page-break">
            
            {/* Header Area */}
            <div className="flex justify-between items-start mb-6">
              {/* Logo reconstructed with exact details */}
              <NusantaraLogo size="md" className="items-start text-left" companyName={userProfile?.companyName} />
              
              <div className="text-right text-stone-400 font-mono text-[10px] mt-2">
                Halaman: 2 / {isLoadingPages ? '...' : totalPagesCount} (Pengajuan)
              </div>
            </div>

            {/* Document Title Block */}
            <div className="border-[2px] border-black bg-[#D9D9D9] py-2.5 text-center mb-6">
              <h1 className="text-base font-bold text-black font-sans uppercase tracking-[1px]">
                FORMULIR PENGAJUAN HO
              </h1>
            </div>

            {/* Metadata Fields Box */}
            <div className="border border-black p-4 mb-6 text-sm font-sans">
              <div className="grid grid-cols-[140px_10px_1fr] gap-y-2">
                <span className="font-semibold text-black">Lokasi</span>
                <span className="text-black">:</span>
                <span className="text-black">{submission.lokasi}</span>

                <span className="font-semibold text-black">Tanggal</span>
                <span className="text-black">:</span>
                <span className="text-black">{formatDateIndonesian(submission.tanggal)}</span>

                <span className="font-semibold text-black">Jenis Pengajuan</span>
                <span className="text-black">:</span>
                <span className="text-black">{submission.jenisPengajuan}</span>

                <span className="font-semibold text-black">Kode</span>
                <span className="text-black">:</span>
                <span className="text-black font-mono">{submission.kode}</span>
              </div>
            </div>

            {/* Main Items Table */}
            <div className="mb-6">
              <table className="w-full border-collapse border-[1.5px] border-black text-sm table-fixed">
                <thead>
                  <tr className="bg-[#D9D9D9]/30 border-b-[1.5px] border-black text-black font-bold uppercase text-xs">
                    <th className="border-r border-black py-2 px-1 text-center w-[5%]">NO</th>
                    <th className="border-r border-black py-2 px-3 text-left w-[49%]">ITEM DETIL (INVOICE / DESKRIPSI)</th>
                    <th className="border-r border-black py-2 px-2 text-center w-[10%]">VOLUME</th>
                    <th className="border-r border-black py-2 px-3 text-center w-[14%]">TOTAL (RP)</th>
                    <th className="py-2 px-3 text-left w-[22%]">KETERANGAN</th>
                  </tr>
                </thead>
                <tbody>
                  {submission.items.map((item, idx) => (
                    <tr key={item.id} className="border-b border-black align-top text-black">
                      <td className="border-r border-black py-2 px-1 text-center font-mono text-xs">{idx + 1}</td>
                      <td className="border-r border-black py-2 px-3 font-semibold text-xs leading-relaxed break-words whitespace-pre-wrap text-stone-900">{item.item}</td>
                      <td className="border-r border-black py-2 px-2 text-center text-xs text-stone-800">{item.jumlahVolume || '-'}</td>
                      <td className="border-r border-black py-2 px-3 text-right font-mono font-bold text-xs font-semibold">
                        {formatRupiah(item.total)}
                      </td>
                      <td className="py-2 px-3 text-stone-700 text-[10px] italic break-all break-words whitespace-pre-wrap leading-tight text-left">{item.keterangan || '-'}</td>
                    </tr>
                  ))}
                  
                  {/* Total Row */}
                  <tr className="border-t-[1.5px] border-black font-bold text-black bg-stone-50">
                    <td colSpan={3} className="border-r border-black py-2 px-4 text-center uppercase tracking-wider text-xs">
                       TOTAL PENYERAHAN
                    </td>
                    <td className="border-r border-black py-2 px-3 text-right font-mono text-sm font-bold bg-amber-50/10">
                      {formatRupiah(grandTotal)}
                    </td>
                    <td className="py-2 px-3 bg-stone-50"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Signatures Row */}
            <div className="flex justify-between px-10 mb-8 mt-12 text-sm text-black">
              <div className="flex flex-col items-center w-60">
                 <span className="font-sans font-medium mb-16">Dibuat Oleh</span>
                <span className="border-b border-black pb-0.5 px-4 font-bold tracking-wide">
                  {submission.dibuatOleh}
                </span>
              </div>
              
              <div className="flex flex-col items-center w-60">
                <span className="font-sans font-medium mb-16">Disetujui</span>
                <span className="border-b border-black pb-0.5 px-4 font-bold tracking-wide">
                  {submission.disetujuiOleh}
                </span>
              </div>
            </div>

            {/* Notes Section - Exact match to PDF 1 bottom layout */}
            <div className="mt-8">
              <span className="block text-xs font-bold text-black tracking-wide uppercase mb-1">
                NOTE :
              </span>
              <div className="border-[1.5px] border-black p-4 min-h-[70px] rounded-xs text-sm text-stone-800 leading-relaxed font-sans bg-stone-50/30">
                {submission.notes ? submission.notes : ""}
              </div>
            </div>

          </div>
        )}

        {/* Loading state indicator on screen only */}
        {isLoadingPages && (
          <div className="w-[210mm] min-h-[140mm] bg-white border border-stone-250 shadow-md rounded-xl p-8 flex flex-col items-center justify-center gap-3 print:hidden">
            <Loader2 size={36} className="animate-spin text-amber-500" />
            <span className="text-sm font-semibold text-stone-700">Mempersiapkan Lembar Lampiran Bukti Transaksi...</span>
            <span className="text-xs text-stone-400 font-mono animate-pulse">{loadingProgress}</span>
          </div>
        )}

        {/* Error state indicator on screen only */}
        {loadError && (
          <div className="w-[210mm] min-h-[100mm] bg-rose-50 border border-rose-250 rounded-xl p-8 flex flex-col items-center justify-center gap-3 print:hidden shadow-xs">
            <Cloud size={36} className="text-rose-500" />
            <span className="text-sm font-bold text-rose-800 text-center">{loadError}</span>
            <p className="text-xs text-rose-600 text-center max-w-lg mb-2 leading-relaxed">
              Sesi koneksi Google Drive Anda kemungkinan sudah kedaluwarsa (berlaku maksimum 60 menit semenjak login terakhir demi keamanan Google), atau berkas tidak diatur agar dapat diakses oleh publik. Silakan sambungkan kembali.
            </p>
            <button
              onClick={async () => {
                try {
                  setIsLoadingPages(true);
                  setLoadError('');
                  setLoadingProgress('Menghubungkan ke Google Drive...');
                  const res = await googleDriveLogin();
                  if (res && res.accessToken) {
                    setReloadTrigger(prev => prev + 1);
                  } else {
                    throw new Error('Gagal mendapatkan token akses baru.');
                  }
                } catch (err: any) {
                  setLoadError(`Gagal menyambungkan kembali Google Drive: ${err?.message || err}`);
                } finally {
                  setIsLoadingPages(false);
                }
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Cloud size={14} />
              Sambungkan Ulang Google Drive
            </button>
          </div>
        )}

        {/* ================= PAGE 3+: LAMPIRAN DOKUMEN BUKTI (DYNAMIC SEVERAL PAGES) ================= */}
        {(activeTab === 'both' || activeTab === 'lampiran') && !isLoadingPages && renderedPages.map((page, idx) => {
          const pageNum = 3 + idx;
          const fileObj = attachmentFiles[page.fileIndex];
          const fileLabel = fileObj?.isBuktiPembayaran ? 'Bukti Bayar'
                          : fileObj?.docType === 'po' ? 'PO'
                          : fileObj?.docType === 'lhv' ? 'LHV'
                          : fileObj?.docType === 'draft_survei' ? 'Survei'
                          : fileObj?.docType === 'bill_of_lading' ? 'Bill of Lading'
                          : fileObj?.docType === 'cargo_manifest' ? 'Cargo'
                          : fileObj?.docType === 'cow_coa_ds_bongkar' ? 'COW & COA DS Bongkar'
                          : fileObj?.docType === 'bukti_pembayaran_batubara' ? 'P.Batubara'
                          : fileObj?.docType === 'bukti_shipment_tongkang_founder' ? 'S.Tongkang'
                          : fileObj?.docType === 'bukti_pajak_trader_founder' ? 'Pajak Trader'
                          : fileObj?.docType === 'merged_all' ? 'Gabungan Dokumen Utama'
                          : `Lampiran B${page.fileIndex + 1}`;

          return (
            <React.Fragment key={page.id}>
              {/* Divider for Screen View, hidden during printing */}
              {activeTab === 'both' && (
                <div className="w-[210mm] border-t-2 border-dashed border-stone-300 py-3 print:hidden flex justify-center">
                  <span className="text-xs bg-stone-100 text-[#917118] px-3 py-1 rounded-full font-semibold uppercase font-mono">
                    BATAS HALAMAN {fileLabel.toUpperCase()} (PAGE BREAK)
                  </span>
                </div>
              )}

              <div className="w-[210mm] min-h-[297mm] h-[297mm] bg-white border border-stone-250 shadow-md rounded-xl print:shadow-none print:border-none print:rounded-none print:p-0 print:m-0 page-break flex items-center justify-center relative overflow-hidden bg-stone-50/10">
                {/* Visualizer Image matching exactly the PDF pages as requested */}
                <img
                  src={page.dataUrl}
                  alt={page.fileName}
                  className="max-w-full max-h-full object-contain print:max-h-screen"
                />

                {/* Floating screen-only badge to maintain complete page counts */}
                <div className="absolute top-4 right-4 bg-stone-900/85 text-white font-mono text-[9px] px-2.5 py-1 rounded-md shadow-md flex items-center gap-1.5 select-none print:hidden z-10">
                  <FileText size={10} className="text-amber-400" />
                  <span>
                    Halaman {pageNum} / {totalPagesCount} ({fileLabel} - Hal {page.pageNumber})
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}

      </div>

      {/* Styled inline media-print stylesheet to dynamically align perfectly fit elements */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 15mm 12mm 15mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .page-break {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .page-break:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }
          /* Ensure no cutoffs or overlapping content */
          table {
            page-break-inside: avoid;
          }
        }
      `}</style>

    </div>
  );
};

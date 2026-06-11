import React, { useState, useEffect } from 'react';
import { Submission } from '../types';
import { loadSubmissionsFromFirestore, saveSubmissionToFirestore, isFirebaseConfigured } from '../firebase';
import { formatRupiah, formatDateIndonesian } from '../utils';
import { 
  ArrowLeft, 
  UploadCloud, 
  CheckCircle, 
  Search, 
  FileText, 
  X, 
  CornerDownRight, 
  CreditCard,
  Building,
  Calendar,
  User,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

interface InputBuktiTransferProps {
  onBack: () => void;
  submissions: Submission[];
  onUpdateSubmissions: (updatedSubmissions: Submission[]) => void;
}

export const InputBuktiTransfer: React.FC<InputBuktiTransferProps> = ({ 
  onBack, 
  submissions: parentSubmissions, 
  onUpdateSubmissions 
}) => {
  const [localSubmissions, setLocalSubmissions] = useState<Submission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; base64: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successCode, setSuccessCode] = useState('');

  // Fetch the latest submissions on mount to ensure freshness
  useEffect(() => {
    const fetchLatest = async () => {
      setIsLoading(true);
      try {
        if (isFirebaseConfigured()) {
          const freshData = await loadSubmissionsFromFirestore();
          if (freshData && freshData.length > 0) {
            setLocalSubmissions(freshData);
            onUpdateSubmissions(freshData);
            return;
          }
        }
      } catch (err) {
        console.warn('Silent read fallback to parent submissions list', err);
      }
      
      // Fallback to parents
      setLocalSubmissions(parentSubmissions.length > 0 ? parentSubmissions : loadFromLocalStorage());
      setIsLoading(false);
    };

    fetchLatest();
  }, []);

  const loadFromLocalStorage = (): Submission[] => {
    try {
      const stored = localStorage.getItem('NUSANTARA_HO_SUBMISSIONS');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  };

  // Drag and drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;

    // Check size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorText('File terlalu besar. Batas ukuran maksimal adalah 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      if (base64Data) {
        setUploadedFile({
          name: file.name,
          base64: base64Data
        });
        setErrorText('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
  };

  // Submit Uploaded Receipt
  const handleSubmitReceipt = async () => {
    if (!selectedSubmission) {
      setErrorText('Harap pilih salah satu pengajuan voucher terlebih dahulu.');
      return;
    }
    if (!uploadedFile) {
      setErrorText('Harap unggah atau drop file bukti transfer terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setErrorText('');

    try {
      const updatedSubmission: Submission = {
        ...selectedSubmission,
        status: 'Lunas',
        buktiPembayaran: {
          url: uploadedFile.base64,
          name: uploadedFile.name
        },
        // Also append to googleDriveFiles array so it renders organically as attachment page
        googleDriveFiles: [
          ...(selectedSubmission.googleDriveFiles || []).filter(
            f => !f.isBuktiPembayaran
          ),
          {
            url: uploadedFile.base64,
            name: `Bukti Pembayaran - ${uploadedFile.name}`,
            isBuktiPembayaran: true
          }
        ]
      };

      // Save to server
      if (isFirebaseConfigured()) {
        // Find user company details inside other entries if available or defaults
        let finalCompanyId = 'nmsa';
        let finalCompanyName = 'PT Nusantara Mineral Sukses Abadi';

        // Check if there is a company detail stored in database or retrieve from locals
        try {
          const matched = localSubmissions.find(s => s.id === selectedSubmission.id);
          // If we had company meta in matched, we might extract it
        } catch {}

        await saveSubmissionToFirestore(updatedSubmission, finalCompanyId, finalCompanyName);
      }

      // Update local listing states to persist immediately
      const nextList = localSubmissions.map(sub => 
        sub.id === selectedSubmission.id ? updatedSubmission : sub
      );

      setLocalSubmissions(nextList);
      onUpdateSubmissions(nextList);
      
      // Save directly to localStorage as a fallback client state
      try {
        localStorage.setItem('NUSANTARA_HO_SUBMISSIONS', JSON.stringify(nextList));
      } catch (localSaveErr) {
        console.warn(localSaveErr);
      }

      setSuccessCode(selectedSubmission.kode || 'BKK-VOUCHER');
      setIsSuccess(true);
      setUploadedFile(null);
      setSelectedSubmission(null);
    } catch (err: any) {
      console.error(err);
      setErrorText(`Gagal menyimpan bukti pembayaran: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter Submissions
  const filteredSubmissions = localSubmissions.filter(sub => {
    const q = searchQuery.toLowerCase();
    const matchesCode = (sub.kode || '').toLowerCase().includes(q);
    const matchesRecipient = (sub.dibayarkanKepada || '').toLowerCase().includes(q);
    const matchesType = (sub.jenisPengajuan || '').toLowerCase().includes(q);
    
    // Check item descriptions
    const matchesItems = sub.items?.some(item => 
      (item.item || '').toLowerCase().includes(q) || 
      (item.keterangan || '').toLowerCase().includes(q)
    );

    return matchesCode || matchesRecipient || matchesType || matchesItems;
  });

  // Group pending/unpaid first
  const pendingSubmissions = filteredSubmissions.filter(sub => sub.status !== 'Lunas');
  const finishedSubmissions = filteredSubmissions.filter(sub => sub.status === 'Lunas');

  const showVoucherList = searchQuery.trim().length > 0 || localSubmissions.length > 0;

  return (
    <div className="max-w-4xl mx-auto py-4 px-2 sm:px-6">
      
      {/* CARD LAYOUT OVERALL */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden transition-all duration-300">
        
        {/* TOP STATUS BAR ACCENT */}
        <div className="h-2 bg-gradient-to-r from-stone-800 via-[#D4AF37] to-stone-900"></div>

        {/* HEADER AREA */}
        <div className="p-6 sm:p-8 border-b border-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-50/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1 px-2.5 bg-[#D4AF37]/10 text-[#a58421] rounded-full text-[10px] font-mono font-bold tracking-wider uppercase">
                Fitur Public Uploader
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight font-sans">
              Formulir Input Bukti Transfer HO
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 font-medium font-sans mt-1">
              Unggah bukti pembayaran bank/transfer untuk memverifikasi voucher transaksi secara otomatis.
            </p>
          </div>
          
          <button
            onClick={onBack}
            className="flex items-center justify-center gap-1.5 px-4 py-2 border border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl shadow-3xs cursor-pointer transition"
          >
            <ArrowLeft size={14} />
            <span>Kembali Ke Portal</span>
          </button>
        </div>

        {/* IF SUCCESS COMPONENT */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-6 max-w-xl mx-auto my-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-emerald-100">
              <CheckCircle size={32} className="stroke-[2.5]" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-stone-900">Bukti Transfer Berhasil Disimpan!</h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                Berkas bukti pembayaran untuk voucher <strong className="font-mono text-stone-800">{successCode}</strong> telah diunggah dan disimpan ke database cloud. Status voucher otomatis divalidasi menjadi <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full text-xs">LUNAS</span>.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setSuccessCode('');
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-stone-800 to-stone-900 hover:from-stone-900 hover:to-black text-white rounded-xl text-xs font-bold shadow-xs transition duration-200 cursor-pointer"
              >
                Unggah Bukti Lainnya
              </button>
              
              <button
                onClick={onBack}
                className="px-6 py-2.5 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Ke Menu Utama
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-8">
            
            {/* STEP 1: CHOOSE PROTOCOL / VOUCHER LIST */}
            <div className="space-y-3">
              <label className="block text-xs font-bold font-mono text-stone-400 uppercase tracking-widest">
                Langkah 1: Cari & Pilih Pengajuan Voucher HO
              </label>
              
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-stone-400" size={18} />
                <input
                  type="text"
                  placeholder="Cari berdasarkan Kode Voucher, Penerima / Rekening, atau Nominal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-stone-50 text-stone-900 border border-stone-200 rounded-xl focus:border-stone-400 focus:outline-hidden transition text-sm shadow-3xs placeholder:text-stone-400"
                />
              </div>

              {/* LIVE DATABASE SELECTION DROP MENU */}
              {showVoucherList && (
                <div className="max-h-60 overflow-y-auto border border-stone-200 rounded-xl bg-white shadow-md divide-y divide-stone-100">
                  
                  {/* PENDING HO TRANSACTION HEAD */}
                  {pendingSubmissions.length > 0 && (
                    <div className="bg-amber-50/50 px-4 py-2 text-[10px] font-bold font-mono text-[#a58421] flex items-center justify-between sticky top-0 bg-white">
                      <span>BELUM LUNAS ({pendingSubmissions.length}) - DIREKOMENDASIKAN</span>
                      <CornerDownRight size={10} />
                    </div>
                  )}

                  {pendingSubmissions.map((sub) => {
                    const totalVoucher = sub.items?.reduce((sum, i) => sum + (Number(i.total) || 0), 0) || 0;
                    const isSelected = selectedSubmission?.id === sub.id;
                    
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setErrorText('');
                        }}
                        className={`w-full text-left p-3.5 sm:px-5 flex justify-between items-center transition cursor-pointer ${
                          isSelected ? 'bg-amber-50/30 font-semibold border-l-4 border-[#D4AF37]' : 'hover:bg-stone-50/80'
                        }`}
                      >
                        <div className="space-y-1 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-stone-900 font-bold">{sub.kode || 'BKK-KODE'}</span>
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold font-mono rounded">Pending</span>
                          </div>
                          <div className="text-xs text-stone-500">
                            Penerima: <strong className="text-stone-700 font-medium">{sub.dibayarkanKepada || '-'}</strong> | {formatDateIndonesian(sub.tanggal)}
                          </div>
                        </div>
                        <div className="text-right text-xs font-mono font-bold text-stone-900 shrink-0">
                          {formatRupiah(totalVoucher)}
                        </div>
                      </button>
                    );
                  })}

                  {/* PAID SELECTION AS REFERENCE WITH OPTIONAL REUPLOAD */}
                  {finishedSubmissions.length > 0 && (
                    <div className="bg-stone-50 px-4 py-2 text-[10px] font-bold font-mono text-stone-500 flex items-center justify-between sticky top-0 bg-white">
                      <span>SUDAH LUNAS ({finishedSubmissions.length}) - UNTUK REUPLOAD</span>
                      <CheckCircle size={10} className="text-emerald-500" />
                    </div>
                  )}

                  {finishedSubmissions.map((sub) => {
                    const totalVoucher = sub.items?.reduce((sum, i) => sum + (Number(i.total) || 0), 0) || 0;
                    const isSelected = selectedSubmission?.id === sub.id;
                    
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(sub);
                          setErrorText('');
                        }}
                        className={`w-full text-left p-3.5 sm:px-5 flex justify-between items-center transition cursor-pointer ${
                          isSelected ? 'bg-emerald-50/10 font-semibold border-l-4 border-emerald-500' : 'hover:bg-stone-50/80'
                        }`}
                      >
                        <div className="space-y-1 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-stone-500 font-medium line-through">{sub.kode}</span>
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold font-mono rounded">Lunas</span>
                          </div>
                          <div className="text-xs text-stone-400">
                            Penerima: <strong className="text-stone-650 font-medium">{sub.dibayarkanKepada || '-'}</strong> | {formatDateIndonesian(sub.tanggal)}
                          </div>
                        </div>
                        <div className="text-right text-xs font-mono font-medium text-stone-400 shrink-0">
                          {formatRupiah(totalVoucher)}
                        </div>
                      </button>
                    );
                  })}

                  {filteredSubmissions.length === 0 && (
                    <div className="p-8 text-center text-stone-400 text-xs font-sans">
                      Tidak menemukan voucher yang cocok dengan kueri "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ERROR DISPLAY BOX */}
            {errorText && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 animate-pulse">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorText}</span>
              </div>
            )}

            {/* SELECTED VOUCHER DISPLAY DATA CARD */}
            {selectedSubmission && (
              <div className="bg-stone-50 rounded-xl p-5 border border-stone-200 flex flex-col md:flex-row justify-between gap-6 animate-fade-in">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] bg-stone-200 text-stone-600 font-mono font-bold uppercase py-0.5 px-2 rounded-md">
                      Detail Penerima Bukti
                    </span>
                    <h3 className="text-md sm:text-lg font-black text-stone-900 font-sans tracking-tight mt-1.5">
                      {selectedSubmission.kode || 'BKK-VOUCHER'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-stone-600 font-sans">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-stone-450 shrink-0" />
                      <span>Penerima: <strong className="text-stone-800">{selectedSubmission.dibayarkanKepada || '-'}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-stone-450 shrink-0" />
                      <span>Tanggal: <strong className="text-stone-850">{formatDateIndonesian(selectedSubmission.tanggal)}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Building size={14} className="text-stone-450 shrink-0" />
                      <span>Lokasi: <strong className="text-stone-850">{selectedSubmission.lokasi || 'Lt.1'}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-stone-450 shrink-0" />
                      <span>Status: 
                        <strong className={`ml-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono ${
                          selectedSubmission.status === 'Lunas' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-amber-100 text-[#7a5913]'
                        }`}>
                          {selectedSubmission.status || 'Belum Lunas'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="md:text-right flex flex-col md:justify-between shrink-0 font-sans min-h-16">
                  <div className="text-[11px] font-mono font-bold text-stone-400">NOMINAL AKUMULATIF</div>
                  <div className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight font-mono mt-1">
                    {formatRupiah(selectedSubmission.items?.reduce((span, u) => span + (Number(u.total) || 0), 0) || 0)}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: FILE UPLOAD DROPZONE */}
            <div className="space-y-3">
              <label className="block text-xs font-bold font-mono text-stone-400 uppercase tracking-widest">
                Langkah 2: Unggah Berkas Bukti Transfer
              </label>

              {uploadedFile ? (
                // FILE HAS BEEN UPLOADED PREVIEW AREA
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="p-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between text-xs text-stone-700">
                    <div className="flex items-center gap-2 font-mono truncate max-w-[280px] sm:max-w-none">
                      <FileText size={15} className="text-amber-500" />
                      <span className="font-bold truncate">{uploadedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-1 text-stone-400 hover:text-rose-600 hover:bg-stone-100 rounded-md transition cursor-pointer"
                      title="Hapus / ganti lampiran"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  {/* PREVIEW FRAME */}
                  <div className="p-4 bg-stone-50 flex items-center justify-center min-h-48 max-h-96 overflow-hidden relative">
                    {uploadedFile.base64.startsWith('data:image/') ? (
                      <img
                        src={uploadedFile.base64}
                        alt="Bukti Transfer Preview"
                        className="max-h-80 object-contain rounded-md border border-stone-200 shadow-sm"
                      />
                    ) : (
                      <div className="text-center space-y-2 p-6">
                        <FileText size={48} className="text-stone-300 mx-auto" />
                        <p className="text-stone-600 text-xs font-mono font-bold">{uploadedFile.name}</p>
                        <p className="text-stone-400 text-[10px]">Dokumen PDF (Pratinjau langsung tidak tersedia untuk format PDF)</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // DROPZONE CONTAINER
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 transition min-h-48 cursor-pointer ${
                    dragActive 
                      ? 'border-[#D4AF37] bg-stone-50/70' 
                      : 'border-stone-200 hover:border-stone-450 bg-stone-50/20'
                  }`}
                  onClick={() => document.getElementById('bukti_bayar_input')?.click()}
                >
                  <input
                    id="bukti_bayar_input"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  <div className="w-12 h-12 bg-[#D4AF37]/5 text-[#D4AF37] border border-[#D4AF37]/15 rounded-2xl flex items-center justify-center shadow-3xs">
                    <UploadCloud size={24} className="stroke-[1.75]" />
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-stone-800">
                      Drag & Drop bukti pembayaran di sini, atau <span className="text-[#a58421] hover:underline">pilih file</span>
                    </p>
                    <p className="text-[10px] text-stone-400">
                      Mendukung format gambar JPEG, PNG, atau dokumen PDF (Maks. 5 MB)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* BUTTON ACTION PANELS */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-end gap-3 border-t border-stone-100">
              <button
                type="button"
                onClick={onBack}
                className="px-5 py-2.5 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSubmitReceipt}
                disabled={isLoading || !selectedSubmission || !uploadedFile}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition duration-200 ${
                  isLoading || !selectedSubmission || !uploadedFile
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed border border-stone-200 shadow-none' 
                    : 'bg-[#D4AF37] border border-[#D4AF37] hover:bg-[#c39e2e] text-white cursor-pointer hover:shadow-md'
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={14} />
                    <span>Unggah Bukti Bayar & Tandai Lunas</span>
                  </>
                )}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

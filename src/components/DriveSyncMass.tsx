import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Submission, REQUIRED_TRANSACTION_DOCS } from '../types';
import { 
  getStoredGoogleDriveToken, 
  googleDriveLogin, 
  saveSubmissionToFirestore,
  getConnectedDrives
} from '../firebase';
import { 
  generateF1PdfBytes, 
  generateF2PdfBytes, 
  formatDateIndonesian, 
  convertImageToPdf 
} from '../utils';
import { Cloud, Loader2, CheckCircle2, AlertTriangle, Play, RefreshCw, Layers, FolderSync } from 'lucide-react';

interface DriveSyncMassProps {
  submissions: Submission[];
  onUpdateSubmissions: (updated: Submission[]) => void;
}

export const DriveSyncMass: React.FC<DriveSyncMassProps> = ({ submissions, onUpdateSubmissions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [activeDriveEmail, setActiveDriveEmail] = useState<string | null>(null);
  
  // Progress states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0); // overall percentage
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [errorLog, setErrorLog] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check Drive connections
  useEffect(() => {
    const drives = getConnectedDrives();
    if (drives.length > 0) {
      setIsDriveConnected(true);
      setActiveDriveEmail(drives[0].email);
    } else {
      setIsDriveConnected(false);
      setActiveDriveEmail(null);
    }
  }, []);

  const handleConnectDrive = async () => {
    try {
      const loginRes = await googleDriveLogin();
      if (loginRes.accessToken) {
        setIsDriveConnected(true);
        setActiveDriveEmail(loginRes.user.email || 'Google Drive');
        addLog(`Google Drive berhasil terhubung: ${loginRes.user.email}`);
      }
    } catch (err: any) {
      setErrorLog(`Gagal menghubungkan Google Drive: ${err.message || err}`);
    }
  };

  const addLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    setLogs(prev => [...prev, `[${timestamp}] ${text}`]);
  };

  // Scroll to bottom of log terminal
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Folder helper functions
  const getOrCreateFolder = async (token: string, name: string, parentId: string): Promise<string> => {
    const cleanName = name.trim().replace(/'/g, "\\'");
    const query = `name = '${cleanName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }
    
    // Create new
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });
    
    if (!createRes.ok) {
      throw new Error(`Gagal membuat folder: ${name}`);
    }
    const createdData = await createRes.json();
    return createdData.id;
  };

  const getOrCreatePettyCashFolderHierarchy = async (
    token: string,
    custodian: string,
    year: string,
    month: string,
    day: string
  ): Promise<string> => {
    const rootId = 'root';
    const voucherAppId = await getOrCreateFolder(token, 'Voucher-APP', rootId);
    const pettyCashId = await getOrCreateFolder(token, 'Petty Cash', voucherAppId);
    const cleanCustodian = (custodian || 'Pemegang Petty Cash').trim().replace(/[\/\\?%*:|"<>.]/g, '');
    const custodianId = await getOrCreateFolder(token, cleanCustodian, pettyCashId);
    const yearId = await getOrCreateFolder(token, year, custodianId);
    const monthId = await getOrCreateFolder(token, month, yearId);
    const dayId = await getOrCreateFolder(token, day, monthId);
    return dayId;
  };

  const restoreFileFromTrashIfNecessary = async (fileId: string, token: string): Promise<boolean> => {
    try {
      const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,trashed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!checkRes.ok) return false;
      const meta = await checkRes.json();
      if (meta.trashed) {
        addLog(`Mendeteksi berkas "${meta.name}" berada di Sampah (Trash) Google Drive. Memulihkan berkas otomatis...`);
        const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ trashed: false })
        });
        if (patchRes.ok) {
          addLog(`[SUKSES MEMULIHKAN] Berkas "${meta.name}" berhasil dikembalikan dari Sampah Google Drive!`);
          return true;
        } else {
          addLog(`[Peringatan] Gagal memulihkan berkas "${meta.name}" dari Sampah.`);
        }
      }
    } catch (e) {
      console.warn("Error restoring trashed file:", e);
    }
    return false;
  };

  const downloadGoogleDriveFile = async (url: string, token: string): Promise<Uint8Array | null> => {
    try {
      const match = url.match(/[-\w]{25,}/);
      if (!match) return null;
      const fileId = match[0];
      
      // Auto-restore if trashed before attempting download
      await restoreFileFromTrashIfNecessary(fileId, token);
      
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const uploadFileToFolder = async (
    token: string,
    fileName: string,
    fileMimeType: string,
    fileBytes: Uint8Array,
    folderId: string
  ): Promise<{ url: string; name: string }> => {
    // Delete existing duplicate with same name to avoid clutter in the folder
    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`
        )}&fields=files(id)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          for (const existingFile of searchData.files) {
            await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        }
      }
    } catch (dupErr) {
      console.warn('Error checking duplicates:', dupErr);
    }

    const fileBlob = new Blob([fileBytes], { type: fileMimeType });
    const compiledFile = new File([fileBlob], fileName, { type: fileMimeType });

    const metadata = {
      name: fileName,
      mimeType: fileMimeType,
      parents: [folderId],
    };

    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', compiledFile);

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );

    if (!res.ok) {
      throw new Error(`Upload gagal untuk files ${fileName}`);
    }

    const fileData = await res.json();

    // Make shared link accessible
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileData.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });
    } catch (perErr) {
      console.warn('Permission error:', perErr);
    }

    return {
      url: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view?usp=drivesdk`,
      name: fileData.name || fileName,
    };
  };

  const handleStartSync = async () => {
    if (submissions.length === 0) {
      setErrorLog('Tidak ada transaksi untuk disinkronkan.');
      return;
    }

    const token = getStoredGoogleDriveToken();
    if (!token) {
      setErrorLog('Koneksi Google Drive terputus. Silakan hubungkan kembali.');
      return;
    }

    setIsSyncing(true);
    setLogs([]);
    setErrorLog(null);
    setSuccessCount(0);
    setFailedCount(0);
    addLog(`Memulai sinkronisasi massal seluruh (${submissions.length}) transaksi ke Google Drive...`);

    const updatedSubmissions = [...submissions];

    for (let index = 0; index < submissions.length; index++) {
      setCurrentIndex(index);
      const sub = submissions[index];
      const percent = Math.round(((index + 1) / submissions.length) * 100);
      setSyncProgress(percent);

      const kodeStr = sub.kode || 'Tanpa Kode';
      setCurrentStepText(`Memproses [${index + 1}/${submissions.length}] - Kode: ${kodeStr}`);
      addLog(`Mulai mengunggah ulang transaksi: ${kodeStr} - ${sub.jenisPengajuan}...`);

      try {
        // Compute date parts
        const parts = (sub.tanggal || '').split('-');
        let yearStr = '2026';
        let monthStr = '1. Januari';
        let dayStr = '1';

        const INDONESIAN_MONTHS = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];

        if (parts.length === 3) {
          yearStr = parts[0];
          const monthIdx = parseInt(parts[1], 10) - 1;
          const mNum = monthIdx + 1;
          const mName = INDONESIAN_MONTHS[monthIdx] || 'Januari';
          monthStr = `${mNum}. ${mName}`;
          dayStr = String(parseInt(parts[2], 10));
        } else {
          const dateObj = new Date(sub.createdAt || Date.now());
          yearStr = String(dateObj.getFullYear());
          const mNum = dateObj.getMonth() + 1;
          const mName = INDONESIAN_MONTHS[dateObj.getMonth()];
          monthStr = `${mNum}. ${mName}`;
          dayStr = String(dateObj.getDate());
        }

        // Determine company upper folder name
        let companyCode = 'nmsa';
        if (sub.kode) {
          const rawMatch = sub.kode.split('-');
          if (rawMatch.length >= 2) {
            companyCode = rawMatch[1].toLowerCase();
          }
        }
        if (!companyCode || /^\d+$/.test(companyCode)) {
          companyCode = 'nmsa';
        }
        const folderCompanyUpper = companyCode.toUpperCase();

        // 1. Create/Retrieve company, year, month, day path
        const rootId = 'root';
        const voucherAppId = await getOrCreateFolder(token, 'Voucher-APP', rootId);
        const companyId = await getOrCreateFolder(token, folderCompanyUpper, voucherAppId);
        const yearId = await getOrCreateFolder(token, yearStr, companyId);
        const monthId = await getOrCreateFolder(token, monthStr, yearId);
        const dayId = await getOrCreateFolder(token, dayStr, monthId);

        // Name of transaction custom folder
        const cleanJenis = (sub.jenisPengajuan || 'Pengajuan').trim().replace(/[\/\\?%*:|"<>.]/g, '');
        const cleanPenerima = (sub.dibayarkanKepada || 'Penerima').trim().replace(/[\/\\?%*:|"<>.]/g, '');
        const txFolderName = `${cleanJenis} - ${cleanPenerima}`;
        const targetFolderId = await getOrCreateFolder(token, txFolderName, dayId);

        addLog(`Folder Tujuan: /Voucher-APP/${folderCompanyUpper}/${yearStr}/${monthStr}/${dayStr}/${txFolderName}`);

        // Prepare items and grandTotal
        const subItems = sub.items || [];
        const grandTotal = subItems.reduce((acc, current) => acc + (current.total || 0), 0);

        const freshFinalFiles: { url: string; name: string; isF1?: boolean; isF2?: boolean; isBuktiPembayaran?: boolean; docType?: string }[] = [];
        let freshBuktiPembayaran: { url: string; name: string } | undefined = undefined;

        // 2. Generate and Upload F1
        addLog(`Menggambar & Mengunggah F1 Bukti Pengeluaran Kas/Bank...`);
        const f1PdfBytes = await generateF1PdfBytes(sub, grandTotal);
        const f1Data = await uploadFileToFolder(
          token,
          `F1 - (${cleanJenis} - ${cleanPenerima}).pdf`,
          'application/pdf',
          f1PdfBytes,
          targetFolderId
        );
        freshFinalFiles.push({
          url: f1Data.url,
          name: f1Data.name,
          isF1: true
        });

        // 3. Generate and Upload F2
        addLog(`Menggambar & Mengunggah F2 Form Pengajuan HO...`);
        const f2PdfBytes = await generateF2PdfBytes(sub, grandTotal);
        const f2Data = await uploadFileToFolder(
          token,
          `F2 - (${cleanJenis} - ${cleanPenerima}).pdf`,
          'application/pdf',
          f2PdfBytes,
          targetFolderId
        );
        freshFinalFiles.push({
          url: f2Data.url,
          name: f2Data.name,
          isF2: true
        });

        // 4. Download and Re-Upload existing supporting docs
        const existingDocs = (sub.googleDriveFiles || []).filter(
          f => !f.isF1 && !f.isF2 && !f.isBuktiPembayaran && !f.name.startsWith('F1 -') && !f.name.startsWith('F2 -')
        );

        for (let docIdx = 0; docIdx < existingDocs.length; docIdx++) {
          const doc = existingDocs[docIdx];
          addLog(`Mencadangkan berkas lampiran (${docIdx + 1}/${existingDocs.length}): ${doc.name}...`);
          const fileBytes = await downloadGoogleDriveFile(doc.url, token);
          if (fileBytes) {
            let mimeType = 'application/octet-stream';
            if (doc.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
            else if (doc.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            else if (doc.name.toLowerCase().endsWith('.jpg') || doc.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';

            const resData = await uploadFileToFolder(token, doc.name, mimeType, fileBytes, targetFolderId);
            freshFinalFiles.push({
              url: resData.url,
              name: resData.name,
              docType: doc.docType
            });
            addLog(`Grup lampiran dicadangkan: ${doc.name}`);
          } else {
            // Keep existing entry as fallback if it couldn't be downloaded
            addLog(`[Peringatan] Berkas lampiran asli tidak bisa diunduh, menyertakan link lama: ${doc.name}`);
            freshFinalFiles.push(doc);
          }
        }

        // 5. Download and Re-Upload Bukti Pembayaran if any
        const existingPaymentDoc = sub.buktiPembayaran || (sub.googleDriveFiles || []).find(f => f.isBuktiPembayaran);
        if (existingPaymentDoc) {
          addLog(`Mengunduh & Memulihkan Berkas Bukti Pembayaran...`);
          const fileBytes = await downloadGoogleDriveFile(existingPaymentDoc.url, token);
          if (fileBytes) {
            const folderBuktiBayarId = await getOrCreateFolder(token, 'Bukti Pembayaran', targetFolderId);
            let mimeType = 'application/octet-stream';
            if (existingPaymentDoc.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
            else if (existingPaymentDoc.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            else if (existingPaymentDoc.name.toLowerCase().endsWith('.jpg') || existingPaymentDoc.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';

            const resData = await uploadFileToFolder(token, existingPaymentDoc.name, mimeType, fileBytes, folderBuktiBayarId);
            freshBuktiPembayaran = resData;
            freshFinalFiles.push({
              url: resData.url,
              name: resData.name,
              isBuktiPembayaran: true
            });
            addLog(`Bukti Pembayaran berhasil dipulihkan & disimpan.`);
          } else {
            addLog(`[Peringatan] Gagal memindahkan Bukti Pembayaran asli, menyalin link lama.`);
            freshBuktiPembayaran = existingPaymentDoc;
            freshFinalFiles.push({
              url: existingPaymentDoc.url,
              name: existingPaymentDoc.name,
              isBuktiPembayaran: true
            });
          }
        }

        // 6. Upload Petty Cash LPJ file if applicable
        if (sub.isPettyCash && sub.pettyCashFile) {
          addLog(`Mengunduh & Menyusun LPJ Petty Cash...`);
          const fileBytes = await downloadGoogleDriveFile(sub.pettyCashFile.url, token);
          if (fileBytes) {
            const pchyHierarchyId = await getOrCreatePettyCashFolderHierarchy(
              token,
              sub.pettyCashCustodian || 'Custodian',
              yearStr,
              monthStr,
              dayStr
            );
            let mimeType = 'application/octet-stream';
            if (sub.pettyCashFile.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
            else if (sub.pettyCashFile.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
            else if (sub.pettyCashFile.name.toLowerCase().endsWith('.jpg') || sub.pettyCashFile.name.toLowerCase().endsWith('.jpeg')) mimeType = 'image/jpeg';

            const resData = await uploadFileToFolder(token, sub.pettyCashFile.name, mimeType, fileBytes, pchyHierarchyId);
            sub.pettyCashFile = resData;
            addLog(`Laporan pertanggungjawaban Petty Cash terunggah.`);
          }
        }

        // Update target object
        const updatedSub: Submission = {
          ...sub,
          googleDriveFiles: freshFinalFiles,
          buktiPembayaran: freshBuktiPembayaran || sub.buktiPembayaran
        };

        // Save back to firestore & update parental cache list
        await saveSubmissionToFirestore(updatedSub);
        
        // Find index in parent array and replace
        updatedSubmissions[index] = updatedSub;
        setSuccessCount(prev => prev + 1);
        addLog(`[SUKSES] Transaksi ${kodeStr} berhasil disinkronkan sepenuhnya!`);
      } catch (subErr: any) {
        setFailedCount(prev => prev + 1);
        addLog(`[EROR] Gagal mengunggah transaksi ${kodeStr}: ${subErr.message || subErr}`);
        console.error(subErr);
      }
    }

    // Persist finalized array
    onUpdateSubmissions(updatedSubmissions);
    setIsSyncing(false);
    setCurrentStepText('Sinkronisasi Massal Selesai!');
    addLog(`== SELESAI == Berhasil memperbarui ${successCount + failedCount} dokumen. Sukses: ${successCount}, Eror: ${failedCount}.`);
  };

  return (
    <div className="bg-white border border-stone-150 rounded-2xl shadow-sm p-5 max-w-4xl mx-auto my-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl shrink-0">
            <FolderSync size={24} className="text-amber-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-black text-stone-900 font-display">Hubungkan & Sinkronkan Google Drive HO</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Kelola penomoran struktur folder bulan terurut di awan (Cloud) dan sinkronkan data agar tidak ada yang terhapus secara tidak sengaja.
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 text-xs font-bold font-display text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-all cursor-pointer"
        >
          {isOpen ? 'Sembunyikan Panel' : 'Buka Pengaturan Sinkronisasi'}
        </button>
      </div>

      {isOpen && (
        <div className="pt-5 space-y-5 animate-fade-in">
          {/* Connection Status Box */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center gap-3">
              <Cloud size={20} className={isDriveConnected ? 'text-emerald-600' : 'text-stone-400'} />
              <div>
                <p className="text-xs font-extrabold text-stone-800">
                  Status Penyimpanan Cloud: {isDriveConnected ? 'Google Drive Terhubung' : 'Google Drive Belum Terhubung'}
                </p>
                {isDriveConnected ? (
                  <p className="text-[10.5px] text-stone-500">Akun Aktif: <strong className="font-mono text-emerald-700 underline shrink-0">{activeDriveEmail}</strong></p>
                ) : (
                  <p className="text-[10.5px] text-stone-400">Hubungkan untuk mengunggah ulang kwitansi and voucher.</p>
                )}
              </div>
            </div>

            {!isDriveConnected ? (
              <button
                type="button"
                onClick={handleConnectDrive}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-amber-950 bg-amber-400 hover:bg-amber-500 rounded-lg transition shadow-xs cursor-pointer"
              >
                Hubungkan Google Drive
              </button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] text-emerald-800 font-bold font-sans">
                Koneksi Aktif
              </div>
            )}
          </div>

          {/* Sync Trigger Section */}
          {isDriveConnected && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 leading-tight">Tekan Sinkronisasi Satu-Klik untuk Sinkronisasi Massal</p>
                  <p className="text-[10.5px] text-stone-600">
                    Sistem akan menyisir seluruh <strong className="text-amber-800 font-mono">{submissions.length} transaksi</strong> Anda, meregenerasi dokumen F1 & F2 yang presisi, merapikan struktur bulan (1. Januari, 2. Februari...), and memulihkan lampiran yang rusak.
                  </p>
                </div>
                
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={handleStartSync}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 disabled:bg-stone-300 rounded-xl shadow-md transition disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Mensinkronkan...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      <span>Sinkronkan Ke Google Drive (1-Klik)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Progress Panel */}
              {isSyncing && (
                <div className="space-y-2 bg-stone-50 border border-stone-200/80 p-4 rounded-xl">
                  <div className="flex justify-between items-center text-xs font-black text-stone-800 font-display">
                    <span>Progres Pengunggahan</span>
                    <span className="font-mono text-amber-700">{syncProgress}%</span>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-stone-200 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full transition-all duration-300"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-stone-600 font-mono mt-2">
                    <span className="truncate max-w-[70%]">{currentStepText}</span>
                    <span>Sukses: {successCount} | Gagal: {failedCount}</span>
                  </div>
                </div>
              )}

              {/* Logs Terminal */}
              {(logs.length > 0 || isSyncing) && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wide">Log Proses Sinkronisasi</label>
                    <button 
                      onClick={() => setLogs([])}
                      className="text-[10px] text-stone-400 hover:text-stone-600 transition"
                      disabled={isSyncing}
                    >
                      Bersihkan Log
                    </button>
                  </div>
                  <div 
                    ref={logContainerRef}
                    className="bg-stone-900 border border-stone-800 text-[11px] text-gray-200 p-3 h-52 overflow-y-auto rounded-xl font-mono leading-relaxed space-y-1 select-text scroll-smooth"
                  >
                    {logs.map((log, index) => {
                      let colorClass = 'text-stone-300';
                      if (log.includes('[SUKSES]')) colorClass = 'text-emerald-400 font-bold';
                      else if (log.includes('[Peringatan]')) colorClass = 'text-amber-400 font-bold';
                      else if (log.includes('[EROR]')) colorClass = 'text-rose-400 font-black';
                      else if (log.includes('== SELESAI ==')) colorClass = 'text-amber-300 font-extrabold border-t border-stone-700 pt-1 mt-1';
                      return (
                        <div key={index} className={colorClass}>
                          {log}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notification Badges */}
              {errorLog && (
                <div className="p-3 bg-rose-50 border border-rose-250 rounded-xl text-[11.5px] text-rose-700 font-medium flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>{errorLog}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

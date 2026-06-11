export interface SubmissionItem {
  id: string;
  no: number;
  item: string;
  jumlahVolume: string;
  total: number;
  keterangan: string;
}

export type PaymentMethod = 'Tunai' | 'Cek/Transfer';

export interface Submission {
  id: string;
  lokasi: string;
  tanggal: string; // ISO format YYYY-MM-DD
  jenisPengajuan: string; // e.g. "Biaya Gaji", "Operasional"
  kode: string; // e.g. "HO"
  dibayarkanKepada: string;
  dibayarkanDengan: PaymentMethod;
  status?: 'Lunas' | 'Belum Lunas';
  notes: string;
  
  // Google Drive attachment support
  googleDriveFileUrl?: string;
  googleDriveFileName?: string;
  googleDriveFiles?: { url: string; name: string; pageCount?: number; isF1?: boolean; isF2?: boolean; isBuktiPembayaran?: boolean }[];
  buktiPembayaran?: { url: string; name: string };
  
  // Signatures for Formulir Pengajuan
  dibuatOleh: string;
  disetujuiOleh: string; // e.g. "Harijon"

  // Signatures for Bukti Pengeluaran Kas/Bank
  diverifikasiOleh: string; // e.g. "Andi Dhiya Salsabila"
  diverifikasiJabatan: string; // e.g. "Keuangan"
  disetujuiOleh2: string; // e.g. "H. A. Nursyam Halid"
  disetujuiJabatan2: string; // e.g. "Direktur Utama"
  dibukukanOleh: string; // e.g. "Sri Ekowati"
  dibukukanJabatan: string; // e.g. "Accounting"

  items: SubmissionItem[];
  createdAt: string;
}

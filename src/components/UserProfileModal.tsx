import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, Mail, Building2, Save, CheckCircle, HardDrive } from 'lucide-react';
import { DriveAccountsManager } from './DriveAccountsManager';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  authUser: any;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  authUser
}) => {
  const [creatorName, setCreatorName] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load custom signature name from localstorage
    const stored = localStorage.getItem('NUSANTARA_DEFAULT_CREATOR_NAME');
    if (stored) {
      setCreatorName(stored);
    } else {
      // Fallback to name in userProfile or default
      setCreatorName(userProfile?.companyDetails?.sigDibuat || userProfile?.fullName || 'Nur Wahyudi');
    }
  }, [userProfile, isOpen]);

  if (!isOpen) return null;

  const handleSaveCreatorName = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('NUSANTARA_DEFAULT_CREATOR_NAME', creatorName.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2500);
  };

  // Human-readable labels
  const userDisplayName = userProfile?.fullName || (authUser ? authUser.email : 'Nur Wahyudi');
  const userEmailAddress = authUser?.email || 'yudiakungaming@gmail.com';
  const userRole = userProfile?.role || 'Admin HO / Staff';
  const companyName = userProfile?.companyName || 'PT. Nusantara Mineral Sukses Abadi';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-stone-900/65 backdrop-blur-xs animate-fade-in print:hidden">
      <div 
        className="relative bg-stone-50 rounded-3xl shadow-xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-stone-150 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl text-[#917118]">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider">
                Profil & Pengaturan Penyimpanan
              </h3>
              <p className="text-[10px] text-stone-400 font-mono">
                Kelola data akun dan multi-drive Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Card: User Details */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 shadow-3xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
              <Building2 size={14} className="text-stone-400" />
              Informasi Akun
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium text-stone-600">
              <div className="space-y-1">
                <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Nama Lengkap</span>
                <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-150">
                  <User size={13} className="text-stone-400" />
                  <span className="text-stone-800 font-bold">{userDisplayName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Email</span>
                <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-150">
                  <Mail size={13} className="text-stone-400" />
                  <span className="text-stone-700 font-mono truncate">{userEmailAddress}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Perusahaan / Lokasi Portal</span>
                <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-150">
                  <Building2 size={13} className="text-stone-400" />
                  <span className="text-stone-800 font-semibold">{companyName}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-stone-400 block text-[9px] uppercase tracking-wider">Peran / Jabatan</span>
                <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-150">
                  <Briefcase size={13} className="text-stone-400" />
                  <span className="text-stone-700">{userRole}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Form: Custom F2 Creator Settings */}
          <form onSubmit={handleSaveCreatorName} className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 shadow-3xs">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-2">
                <Briefcase size={14} className="text-[#917118]" />
                Penandatangan Formulir F2 (Pembuat)
              </h4>
              <p className="text-[10px] text-stone-400 mt-1">
                Setting ini otomatis mengisi nama penandatangan di kolom **"Dibuat Oleh"** pada Formulir Pengajuan F2 yang bersih dan rapi.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="creator-name-input" className="text-stone-500 text-[10px] font-semibold uppercase tracking-wider">
                  Nama Default Pembuat (F2)
                </label>
                <input
                  id="creator-name-input"
                  type="text"
                  required
                  placeholder="Contoh: Nur Wahyudi"
                  value={creatorName}
                  onChange={(e) => {
                    setCreatorName(e.target.value);
                    if (isSaved) setIsSaved(false);
                  }}
                  className="w-full bg-stone-50 hover:bg-stone-100/50 focus:bg-white text-xs font-bold text-stone-800 px-3.5 py-2.5 rounded-xl border border-stone-250 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] outline-hidden transition duration-150"
                />
              </div>

              <button
                type="submit"
                className="bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-3xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Save size={13} className="text-amber-400" />
                Simpan Nama
              </button>
            </div>

            {isSaved && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-250 rounded-xl text-[10px] text-emerald-800 flex items-center gap-2 leading-none font-bold animate-fade-in">
                <CheckCircle size={12} className="text-emerald-600 shrink-0" />
                <span>Nama default pembuat F2 berhasil diperbarui!</span>
              </div>
            )}
          </form>

          {/* Drive Multi-Accounts Segment inside Modal */}
          <div className="space-y-3.5">
            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest pl-1 flex items-center gap-2">
              <HardDrive size={12} />
              Daftar Hubungan Akun Google Penyimpanan
            </h4>
            <DriveAccountsManager />
          </div>

        </div>

        {/* Footer actions */}
        <div className="bg-white px-6 py-4 border-t border-stone-150 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-extrabold rounded-xl transition cursor-pointer"
          >
            Selesai & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

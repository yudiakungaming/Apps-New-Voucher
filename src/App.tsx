import React, { useState, useEffect } from 'react';
import { Submission, SubmissionItem } from './types';
import { INITIAL_SUBMISSIONS } from './data/initialData';
import { SubmissionsList } from './components/SubmissionsList';
import { SubmissionForm } from './components/SubmissionForm';
import { PrintDocument } from './components/PrintDocument';
import { JsonBackup } from './components/JsonBackup';
import { NusantaraLogo } from './components/NusantaraLogo';
import { SheetsImport } from './components/SheetsImport';
import { FirebaseSyncConfig } from './components/FirebaseSyncConfig';
import { AuthGate } from './components/AuthGate';
import { InputBuktiTransfer } from './components/InputBuktiTransfer';
import { 
  isFirebaseConfigured, 
  saveSubmissionToFirestore, 
  deleteSubmissionFromFirestore,
  registerAuthChangeListener,
  getUserProfileFromFirestore,
  loadSubmissionsFromFirestore,
  getCompanyProfileFromFirestore,
  logoutFromFirebase
} from './firebase';
import { Database, FileText, CheckSquare, ShieldCheck, Heart, Cloud } from 'lucide-react';

export default function App() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [view, setView] = useState<'list' | 'form' | 'print'>('list');
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // Synchronous route popstate and hashchange tracking
  useEffect(() => {
    const handleNavigation = () => {
      setCurrentPath(window.location.pathname);
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  const navigateTo = (path: string) => {
    if (path === '/') {
      window.history.pushState({}, '', '/');
      window.location.hash = '';
      setCurrentPath('/');
      setCurrentHash('');
    } else if (path.startsWith('#')) {
      window.location.hash = path;
      setCurrentHash(path);
    } else {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      setCurrentHash('');
    }
  };

  // Listen to Firebase Auth status and load/clear data accordingly
  useEffect(() => {
    // Elegant shared terminal/device logic:
    // If the browser session is fresh (or reopened tab), prevent auto-login by logging out first.
    // Preserves active logins across simple page reloads (F5) through sessionStorage.
    const hasActiveSession = sessionStorage.getItem('NUSANTARA_SESSION_ACTIVE') === 'true';
    if (!hasActiveSession) {
      logoutFromFirebase();
    }

    const unsubscribe = registerAuthChangeListener(async (user) => {
      setAuthUser(user);
      if (!user) {
        // User logged out / not logged in: purge all cache and clear memory state immediately
        setSubmissions([]);
        setUserProfile(null);
        localStorage.removeItem('NUSANTARA_HO_SUBMISSIONS');
        sessionStorage.removeItem('NUSANTARA_SESSION_ACTIVE');
      } else {
        // Mark session as active to prevent force-logout during same-tab refreshes
        sessionStorage.setItem('NUSANTARA_SESSION_ACTIVE', 'true');
        // Fetch user profile info from Firestore collection
        let profile = await getUserProfileFromFirestore(user.uid);
        if (!profile) {
          profile = {
            fullName: user.email === 'admin@nmsa.com' ? 'Nur Wahyudi' : user.email.split('@')[0],
            role: user.email === 'admin@nmsa.com' ? 'Accounting' : 'User',
            email: user.email,
            companyId: 'nmsa',
            companyName: 'PT Nusantara Mineral Sukses Abadi'
          };
        }

        const companyId = profile.companyId || 'nmsa';
        let companyDetails = await getCompanyProfileFromFirestore(companyId);
        
        // If not found, fall back to Nusantara Mineral default template
        if (!companyDetails) {
          companyDetails = {
            id: companyId,
            code: companyId.toUpperCase(),
            name: companyId === 'nmsa' ? 'PT Nusantara Mineral Sukses Abadi' : companyId.toUpperCase(),
            fullName: companyId === 'nmsa' ? 'PT. Nusantara Mineral Sukses Abadi' : companyId.toUpperCase(),
            defaultJenis: 'Operasional Kantor',
            defaultKode: `BKK-${companyId.toUpperCase()}/V/2026/10001`,
            defaultLokasi: 'Lt.1',
            displayName: `Invoice-${companyId.toUpperCase()}`,
            icon: '🏢',
            isActive: true,
            no_invoice_prefix: `BKK-${companyId.toUpperCase()}`,
            sigAccounting: 'Sri Ekowati',
            sigDibuat: 'Nur Wahyudi',
            sigDirKeuangan: 'Harijon',
            sigDirektur: 'Andi Nursyam Halid',
            sigDisetujui: 'Harijon',
            sigKeuangan: 'Andi Dhiya Salsabila'
          };
        }

        const combinedProfile = {
          ...profile,
          companyId,
          companyName: companyDetails.name || companyDetails.fullName || 'PT Nusantara Mineral Sukses Abadi',
          companyDetails
        };
        setUserProfile(combinedProfile);

        // Fetch submissions automatically from Firestore
        try {
          const cloudData = await loadSubmissionsFromFirestore(profile?.companyId);
          if (cloudData && cloudData.length > 0) {
            saveSubmissionsToStorage(cloudData);
          } else {
            const stored = localStorage.getItem('NUSANTARA_HO_SUBMISSIONS');
            if (stored) {
              setSubmissions(JSON.parse(stored));
            } else {
              setSubmissions([]);
            }
          }
        } catch (e) {
          console.error('Error fetching data from Firestore:', e);
          try {
            const stored = localStorage.getItem('NUSANTARA_HO_SUBMISSIONS');
            if (stored) {
              setSubmissions(JSON.parse(stored));
            } else {
              setSubmissions([]);
            }
          } catch (localStorageErr) {
            console.error('Error loading data from localStorage:', localStorageErr);
            setSubmissions([]);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync state changes with localStorage
  const saveSubmissionsToStorage = (updatedList: Submission[]) => {
    setSubmissions(updatedList);
    try {
      localStorage.setItem('NUSANTARA_HO_SUBMISSIONS', JSON.stringify(updatedList));
    } catch (e) {
      console.error('Error saving data to localStorage:', e);
    }
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    const updated = submissions.filter((sub) => sub.id !== id);
    saveSubmissionsToStorage(updated);
    
    if (isFirebaseConfigured()) {
      try {
        await deleteSubmissionFromFirestore(id);
      } catch (err) {
        console.warn('Silent fallback: cloud delete rejected', err);
      }
    }

    if (activeSubmission?.id === id) {
      setActiveSubmission(null);
      setView('list');
    }
  };

  // Duplicate handler
  const handleDuplicate = async (orig: Submission) => {
    // Generate new ID and reset date to today
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const dy = String(today.getDate()).padStart(2, '0');

    // Deep copy items
    const copiedItems = orig.items.map((item) => ({
      ...item,
      id: Math.random().toString(),
    }));

    const dupe: Submission = {
      ...orig,
      id: `sub-${Date.now()}`,
      tanggal: `${yr}-${mo}-${dy}`,
      dibayarkanKepada: `${orig.dibayarkanKepada} (Salinan)`,
      items: copiedItems,
      createdAt: new Date().toISOString(),
    };

    const updated = [dupe, ...submissions];
    saveSubmissionsToStorage(updated);

    if (isFirebaseConfigured()) {
      try {
        await saveSubmissionToFirestore(dupe, userProfile?.companyId, userProfile?.companyName);
      } catch (err) {
        console.warn('Silent fallback: cloud replicate rejected', err);
      }
    }
  };

  // Save/Update from form submission
  const handleSaveSubmission = async (savedSub: Submission) => {
    let updatedList: Submission[] = [];
    const exists = submissions.some((sub) => sub.id === savedSub.id);

    if (exists) {
      updatedList = submissions.map((sub) => (sub.id === savedSub.id ? savedSub : sub));
    } else {
      updatedList = [savedSub, ...submissions];
    }

    saveSubmissionsToStorage(updatedList);

    if (isFirebaseConfigured()) {
      try {
        await saveSubmissionToFirestore(savedSub, userProfile?.companyId, userProfile?.companyName);
      } catch (err) {
        console.warn('Silent fallback: cloud save rejected', err);
      }
    }

    setEditingSubmission(null);
    setView('list');
  };

  // Import handler for JSON backup
  const handleImportJson = (importedList: Submission[]) => {
    // Overwrite database with imported values, or merge them.
    // Overwriting is safer for full restores, let's offer overwrite + deduplicate based on IDs
    const mergedMap = new Map<string, Submission>();
    
    // Add existing ones first
    submissions.forEach(sub => mergedMap.set(sub.id, sub));
    // Add imported ones (which might overwrite if match ID, otherwise brand new)
    importedList.forEach(sub => mergedMap.set(sub.id, sub));
    
    const updated = Array.from(mergedMap.values());
    // Sort by latest date
    updated.sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    
    saveSubmissionsToStorage(updated);
  };

  // Sync / Import handler for Google Sheets legacy vouchers
  const handleSheetsImport = (importedList: Submission[], mergeMode: 'merge' | 'overwrite') => {
    if (mergeMode === 'overwrite') {
      saveSubmissionsToStorage(importedList);
    } else {
      // Merge mode based on deduplicating ids or invoice notes
      const mergedMap = new Map<string, Submission>();
      submissions.forEach(sub => mergedMap.set(sub.id, sub));
      importedList.forEach(sub => mergedMap.set(sub.id, sub));
      
      const updated = Array.from(mergedMap.values());
      updated.sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      saveSubmissionsToStorage(updated);
    }
  };

  // Sync handler for Firebase Cloud Firestore
  const handleFirebaseSync = (cloudList: Submission[]) => {
    const mergedMap = new Map<string, Submission>();
    submissions.forEach(sub => mergedMap.set(sub.id, sub));
    cloudList.forEach(sub => mergedMap.set(sub.id, sub));
    
    const updated = Array.from(mergedMap.values());
    updated.sort((a,b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    saveSubmissionsToStorage(updated);
  };

  const isIndividualUploaderView = 
    currentPath === '/input-bukti-transfer' || 
    currentHash === '#/input-bukti-transfer' || 
    currentHash === '#input-bukti-transfer';

  if (isIndividualUploaderView) {
    return (
      <div id="app-root" className="min-h-screen bg-stone-50 text-stone-850 flex flex-col antialiased">
        <header className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between min-h-18 py-2 md:py-0">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigateTo('/')}>
                <div className="p-2.5 bg-stone-100 rounded-xl text-stone-800">
                  <Database size={20} className="text-[#D4AF37]" />
                </div>
                <div className="space-y-0.5">
                  <span className="font-mono text-xs uppercase tracking-wider text-stone-400 font-bold block">
                    {userProfile?.companyDetails?.displayName || 'Internal HO System'}
                  </span>
                  <h1 className="text-xs sm:text-sm font-black text-stone-900 tracking-tight flex items-center gap-1.5 font-sans">
                    {userProfile?.companyName ? `${userProfile.companyName} Portal` : 'Nusantara Mineral Payment Portal'}
                  </h1>
                </div>
              </div>

              {/* User Info & Logout Button for Finance View */}
              {authUser && (
                <div className="flex flex-col items-end gap-1.5 text-right py-1">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-stone-600">
                    <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none">
                      Divisi: <strong className="font-sans font-black text-stone-900">{userProfile ? userProfile?.fullName : authUser?.email}</strong> 
                      {userProfile ? ` (${userProfile.role})` : ''}
                    </span>
                  </div>
                  <button
                    id="btn-logout-header-finance"
                    onClick={async () => {
                      try {
                        await logoutFromFirebase();
                      } catch (e) {
                        console.error('Keluar aplikasi gagal:', e);
                      }
                    }}
                    className="text-[9px] font-mono font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md px-2 py-0.5 transition cursor-pointer shadow-3xs flex items-center gap-1"
                    title="Keluar dari sesi saat ini"
                  >
                    <span>Keluar Aplikasi (Logout)</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <InputBuktiTransfer 
            submissions={submissions} 
            userProfile={userProfile}
            onUpdateSubmissions={setSubmissions} 
            onBack={() => navigateTo('/')} 
          />
        </main>

        <footer className="bg-white border-t border-stone-200 py-6 print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-stone-400">
            <div>
              {userProfile?.companyName || 'PT. Nusantara Mineral Sukses Abadi'} &copy; 2026. Semua hak cipta dilindungi.
            </div>
            <div className="flex items-center gap-1 text-stone-200">
              Dibuat dengan <Heart size={10} className="fill-rose-500 text-rose-500 animate-pulse" /> untuk administrasi HO yang modern
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Check Authentication First: enforce AuthGate for ALL pages when unauthenticated
  if (!authUser) {
    return (
      <AuthGate
        onLoginSuccess={(user, initialData) => {
          sessionStorage.setItem('NUSANTARA_SESSION_ACTIVE', 'true');
          setAuthUser(user);
          if (initialData && initialData.length > 0) {
            saveSubmissionsToStorage(initialData);
          } else {
            // Check localstorage content as fallback
            try {
              const stored = localStorage.getItem('NUSANTARA_HO_SUBMISSIONS');
              if (stored) {
                setSubmissions(JSON.parse(stored));
              }
            } catch (e) {
              console.error('Error loading data from localStorage:', e);
            }
          }
        }}
      />
    );
  }

  return (
    <div id="app-root" className="min-h-screen bg-stone-50 text-stone-850 flex flex-col antialiased">
      
      {/* GLOBAL HEADER HEADER - Hidden on print */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-18 py-2 md:py-0">
            {/* Logo area */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('list')}>
              <div className="p-2.5 bg-stone-100 rounded-xl text-stone-800">
                <Database size={20} className="text-[#D4AF37]" />
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-xs uppercase tracking-wider text-stone-400 font-bold block">
                  {userProfile?.companyDetails?.displayName || 'Internal HO System'}
                </span>
                <h1 className="text-xs sm:text-sm font-black text-stone-900 tracking-tight flex items-center gap-1.5 font-sans">
                  {userProfile?.companyName ? `${userProfile.companyName} Portal` : 'Nusantara Mineral Payment Portal'}
                </h1>
              </div>
            </div>

            {/* Support Info & Logout Button */}
            <div className="flex flex-col items-end gap-1.5 text-right py-1">
              <div className="flex items-center gap-1.5 text-xs font-mono text-stone-600">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span className="truncate max-w-[200px] sm:max-w-none">
                  User Aktif: <strong className="font-sans font-black text-stone-900">{userProfile ? userProfile.fullName : (authUser ? authUser.email : 'Nur Wahyudi')}</strong> 
                  {userProfile ? ` (${userProfile.role})` : ''}
                </span>
              </div>
              <button
                id="btn-logout-header"
                onClick={async () => {
                  try {
                    await logoutFromFirebase();
                  } catch (e) {
                    console.error('Keluar aplikasi gagal:', e);
                  }
                }}
                className="text-[9px] font-mono font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md px-2 py-0.5 transition cursor-pointer shadow-3xs flex items-center gap-1"
                title="Keluar dari sesi saat ini"
              >
                <span>Keluar Aplikasi (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      </header>



      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* VIEW 1: Submissions Data History & Backup Operations */}
        {view === 'list' && (
          <div className="space-y-6">
            
            {/* Firebase Live Sync Configuration & Status Panel */}
            <FirebaseSyncConfig
              onSyncData={handleFirebaseSync}
              submissions={submissions}
              userProfile={userProfile}
            />
            
            {/* Sheets Import & Syncer Component */}
            <SheetsImport
              onImportSuccess={handleSheetsImport}
              existingCount={submissions.length}
            />

            {/* Main Listing components */}
            <SubmissionsList
              submissions={submissions}
              onSelect={(sub) => {
                setActiveSubmission(sub);
                setView('print');
              }}
              onEdit={(sub) => {
                setEditingSubmission(sub);
                setView('form');
              }}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onAddNew={() => {
                setEditingSubmission(null);
                setView('form');
              }}
              onOpenBuktiTransfer={() => navigateTo('#/input-bukti-transfer')}
            />

            {/* Backup / Export-Import Section */}
            <div className="pt-4">
              <JsonBackup submissions={submissions} onImport={handleImportJson} />
            </div>
          </div>
        )}

        {/* VIEW 2: Input / Edit Submission Form */}
        {view === 'form' && (
          <SubmissionForm
            initialSubmission={editingSubmission}
            userProfile={userProfile}
            submissions={submissions}
            onSave={handleSaveSubmission}
            onCancel={() => {
              setEditingSubmission(null);
              setView('list');
            }}
          />
        )}

        {/* VIEW 3: Print document presentation with precision styles */}
        {view === 'print' && activeSubmission && (
          <PrintDocument
            submission={activeSubmission}
            userProfile={userProfile}
            onBack={() => {
              setActiveSubmission(null);
              setView('list');
            }}
          />
        )}

      </main>

      {/* COMPACT FOOTER - Hidden on print */}
      <footer className="bg-white border-t border-stone-200 py-6 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-stone-400">
          <div>
            {userProfile?.companyName || 'PT. Nusantara Mineral Sukses Abadi'} &copy; 2026. Semua hak cipta dilindungi.
          </div>
          <div className="flex items-center gap-1 text-stone-300">
            Dibuat dengan <Heart size={10} className="fill-rose-500 text-rose-500 animate-pulse" /> untuk administrasi HO yang lebih modern & efisien
          </div>
        </div>
      </footer>

    </div>
  );
}

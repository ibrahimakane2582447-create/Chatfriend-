import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db, storage } from '../firebase';
import { signOut, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { doc, updateDoc, deleteDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { LogOut, Save, MapPin, Palette, Hash, Image as ImageIcon, AlertTriangle, X, Camera, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [address, setAddress] = useState(profile?.address || '');
  const [theme, setTheme] = useState(profile?.theme || 'dark');
  const [searchId, setSearchId] = useState(profile?.searchId || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl || '');
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [authAction, setAuthAction] = useState<'logout' | 'delete' | null>(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      setIsUploading(true);
      setMessage({ text: '', type: '' });

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `profiles/${user.uid}_${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        setPhotoUrl(downloadUrl);
        
        // Auto-save the new photo URL to Firestore
        await updateDoc(doc(db, 'users', user.uid), {
          photoUrl: downloadUrl
        });
        
        setMessage({ text: 'Photo de profil mise à jour.', type: 'success' });
      } catch (error) {
        console.error("Error uploading profile photo:", error);
        setMessage({ text: 'Erreur lors du téléchargement de la photo.', type: 'error' });
      } finally {
        setIsUploading(false);
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      }
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Check if searchId is unique
      if (searchId !== profile?.searchId) {
        const q = query(collection(db, 'users'), where('searchId', '==', searchId));
        const snap = await getDocs(q);
        if (!snap.empty && snap.docs[0].id !== user.uid) {
          setMessage({ text: 'Ce numéro de recherche est déjà utilisé.', type: 'error' });
          setSaving(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', user.uid), {
        address,
        theme,
        searchId,
        photoUrl
      });
      setMessage({ text: 'Profil mis à jour avec succès.', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Erreur lors de la mise à jour.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  const openAuthModal = (action: 'logout' | 'delete') => {
    setAuthAction(action);
    setPassword('');
    setAuthError('');
    setShowAuthModal(true);
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      if (authAction === 'delete') {
        await deleteDoc(doc(db, 'users', user.uid));
        await deleteUser(user);
        navigate('/auth');
      } else if (authAction === 'logout') {
        await signOut(auth);
        navigate('/auth');
      }
    } catch (err: any) {
      setAuthError('Mot de passe incorrect ou erreur réseau.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="p-4 h-full flex flex-col relative bg-slate-50 text-slate-900">
      <div className="flex justify-between items-center mb-6 px-2">
        <h1 className="text-2xl font-bold">Profil</h1>
        <button 
          onClick={() => openAuthModal('logout')}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center mb-8">
          <div 
            className="relative w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-700 shadow-sm mb-4 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600"></div>
            ) : photoUrl ? (
              <img src={photoUrl} alt="Profil" className="w-full h-full object-cover rounded-full group-hover:opacity-50 transition-opacity" referrerPolicy="no-referrer" />
            ) : (
              <span className="group-hover:opacity-50 transition-opacity">{profile.firstName.charAt(0)}{profile.lastName.charAt(0)}</span>
            )}
            {!isUploading && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full">
                <Camera className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
          <p className="text-slate-500 text-sm">{profile.email}</p>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="space-y-6">
          {/* Settings Form */}
          <div className="bg-white p-4 rounded-2xl space-y-4 shadow-sm border border-slate-100">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Hash className="w-4 h-4" />
                Numéro de recherche
              </label>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Votre numéro de recherche"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <MapPin className="w-4 h-4" />
                Adresse
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Votre adresse (optionnel)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                <Palette className="w-4 h-4" />
                Thème
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-slate-900"
              >
                <option value="light">Clair (Défaut)</option>
                <option value="dark">Sombre</option>
                <option value="system">Système</option>
              </select>
            </div>

            {message.text && (
              <p className={`text-sm text-center py-2 ${message.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                {message.text}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-4 shadow-sm"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>

          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-5 h-5" />
              Installer l'application
            </button>
          )}

          <button
            onClick={() => openAuthModal('delete')}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <AlertTriangle className="w-5 h-5" />
            Supprimer mon compte
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm relative shadow-xl">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="text-xl font-bold mb-2 text-slate-900">
              {authAction === 'delete' ? 'Supprimer le compte' : 'Se déconnecter'}
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Veuillez entrer votre mot de passe pour confirmer cette action.
            </p>

            <form onSubmit={handleAuthAction} className="space-y-4">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
              />
              
              {authError && <p className="text-red-500 text-sm">{authError}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className={`w-full py-3 rounded-xl font-semibold transition-colors shadow-sm ${
                  authAction === 'delete' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {authLoading ? 'Vérification...' : 'Confirmer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

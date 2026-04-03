import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { LogOut, Save, User as UserIcon, MapPin, Palette, Hash } from 'lucide-react';

export default function Profile() {
  const { user, profile } = useAuth();
  const [address, setAddress] = useState(profile?.address || '');
  const [theme, setTheme] = useState(profile?.theme || 'dark');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        address,
        theme
      });
      setMessage('Profil mis à jour avec succès.');
    } catch (error) {
      setMessage('Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (!profile) return null;

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6 px-2">
        <h1 className="text-2xl font-bold">Profil</h1>
        <button 
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-pink-500/20 mb-4">
            {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
          </div>
          <h2 className="text-xl font-bold">{profile.firstName} {profile.lastName}</h2>
          <p className="text-gray-400 text-sm">{profile.email}</p>
        </div>

        <div className="space-y-6">
          {/* Search ID */}
          <div className="bg-gray-900 p-4 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
              <Hash className="w-5 h-5 text-pink-500" />
              <h3 className="font-semibold">Numéro de recherche</h3>
            </div>
            <p className="text-2xl font-mono font-bold text-white tracking-widest text-center py-2">
              {profile.searchId}
            </p>
            <p className="text-xs text-gray-500 text-center">
              Partagez ce numéro pour que vos amis vous trouvent.
            </p>
          </div>

          {/* Settings Form */}
          <div className="bg-gray-900 p-4 rounded-2xl space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <MapPin className="w-4 h-4" />
                Adresse
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Votre adresse (optionnel)"
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Palette className="w-4 h-4" />
                Thème
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-black border border-gray-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-white"
              >
                <option value="dark">Sombre (Défaut)</option>
                <option value="light">Clair</option>
                <option value="system">Système</option>
              </select>
            </div>

            {message && (
              <p className="text-sm text-green-400 text-center py-2">{message}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mt-4"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

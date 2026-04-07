import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { MessageSquare, UserPlus, User, Download, X } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MainLayout() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
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
      setShowBanner(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {deferredPrompt && showBanner && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0 z-50">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Installer Chatfriend</span>
              <span className="text-xs text-blue-100">Accès rapide depuis l'écran d'accueil</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleInstallClick}
              className="bg-white text-blue-600 px-3 py-1.5 rounded-full text-sm font-bold shadow-sm"
            >
              Installer
            </button>
            <button onClick={() => setShowBanner(false)} className="p-1 text-blue-200 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </main>
      
      <nav className="fixed bottom-0 w-full bg-gray-900 border-t border-gray-800 px-6 py-3">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <NavLink
            to="/"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center p-2 transition-colors",
                isActive ? "text-white" : "text-gray-400 hover:text-gray-300"
              )
            }
          >
            <MessageSquare className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Chats</span>
          </NavLink>
          
          <NavLink
            to="/add"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center p-2 transition-colors",
                isActive ? "text-white" : "text-gray-400 hover:text-gray-300"
              )
            }
          >
            <UserPlus className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Ajouter</span>
          </NavLink>
          
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center p-2 transition-colors",
                isActive ? "text-white" : "text-gray-400 hover:text-gray-300"
              )
            }
          >
            <User className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">Profil</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { MessageSquare, UserPlus, User } from 'lucide-react';
import { cn } from '../lib/utils';

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
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

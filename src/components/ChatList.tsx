import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import MyDay from './MyDay';
import { cn } from '../lib/utils';
import CryptoJS from 'crypto-js';

const decryptMessage = (ciphertext: string, secret: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext;
  } catch (e) {
    return ciphertext;
  }
};

export default function ChatList() {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const chatsRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data() as any;
        const otherUserId = data.participants.find((id: string) => id !== user.uid) || user.uid;
        
        // Fetch other user's profile
        let otherUser = { firstName: 'Utilisateur', lastName: 'Inconnu', photoUrl: '' };
        if (otherUserId) {
          const userSnap = await getDoc(doc(db, 'users', otherUserId));
          if (userSnap.exists()) {
            otherUser = userSnap.data() as any;
          }
        }

        return {
          id: chatDoc.id,
          ...data,
          otherUser
        };
      });

      const resolvedChats = await Promise.all(chatPromises);
      
      // Check for new unread messages to show notification
      resolvedChats.forEach(chat => {
        const currentUnread = chat.unreadCount?.[user.uid] || 0;
        const previousChat = chatsRef.current.find(c => c.id === chat.id);
        const previousUnread = previousChat?.unreadCount?.[user.uid] || 0;
        
        if (currentUnread > previousUnread && currentUnread > 0) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Nouveau message de ${chat.otherUser.firstName}`, {
              body: decryptMessage(chat.lastMessage || 'Nouveau message', chat.id),
              icon: '/pwa-192x192.svg'
            });
            
            // Play notification sound
            try {
              const soundPref = profile?.notificationSound || 'default';
              const soundUrl = soundPref === 'default' ? 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' :
                               soundPref === 'bell' ? 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' :
                               soundPref === 'chime' ? 'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3' :
                               soundPref;
              const audio = new Audio(soundUrl);
              audio.play().catch(e => console.log('Audio play failed:', e));
            } catch (e) {
              console.log('Audio creation failed:', e);
            }
          }
        }
      });

      // Sort by lastMessageAt descending
      resolvedChats.sort((a: any, b: any) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
      
      chatsRef.current = resolvedChats;
      setChats(resolvedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600"></div></div>;
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <MyDay />
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center space-y-4">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <MessageSquarePlus className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Aucun contact</h3>
          <p className="text-slate-500 text-sm max-w-xs">
            Aucun contact n'est affiché aléatoire, veuillez ajouter votre premier contact pour commencer à discuter.
          </p>
          <button
            onClick={() => navigate('/add')}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold transition-colors shadow-md"
          >
            Ajouter un contact
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <MyDay />
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          {profile && (
            <div className="flex items-center gap-2 bg-white rounded-full py-1 pl-3 pr-1 border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-mono">ID: {profile.searchId}</span>
              <div className="w-7 h-7 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                {profile.photoUrl ? (
                  <img src={profile.photoUrl} alt="Me" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{profile.firstName.charAt(0)}</>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => navigate(`/chat/${chat.id}`)}
              className="flex items-center p-3 hover:bg-white bg-transparent rounded-2xl cursor-pointer transition-colors"
            >
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-700 shadow-sm shrink-0 overflow-hidden">
                {chat.otherUser.photoUrl ? (
                  <img src={chat.otherUser.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{chat.otherUser.firstName.charAt(0)}{chat.otherUser.lastName.charAt(0)}</>
                )}
              </div>
              <div className="ml-4 flex-1 overflow-hidden border-b border-slate-100 pb-2">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-lg truncate text-slate-900">
                    {chat.otherUser.firstName} {chat.otherUser.lastName} {chat.otherUser.uid === user?.uid && '(Moi)'}
                  </h3>
                  {chat.lastMessageAt && (
                    <span className="text-xs text-slate-400 shrink-0 ml-2">
                      {format(new Date(chat.lastMessageAt), 'HH:mm', { locale: fr })}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <p className={cn("text-sm truncate", chat.unreadCount?.[user?.uid || ''] ? "text-slate-900 font-semibold" : "text-slate-500")}>
                    {decryptMessage(chat.lastMessage || 'Nouvelle discussion', chat.id)}
                  </p>
                  {chat.unreadCount?.[user?.uid || ''] > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0">
                      {chat.unreadCount[user!.uid]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

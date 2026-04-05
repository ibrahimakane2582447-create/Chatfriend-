import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ChatList() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const data = chatDoc.data();
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
      // Sort by lastMessageAt descending
      resolvedChats.sort((a: any, b: any) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setChats(resolvedChats);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-pink-500"></div></div>;
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4">
        <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mb-4">
          <MessageSquarePlus className="w-10 h-10 text-gray-500" />
        </div>
        <h3 className="text-xl font-semibold text-white">Aucun contact</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Aucun contact n'est affiché aléatoire, veuillez ajouter votre premier contact pour commencer à discuter.
        </p>
        <button
          onClick={() => navigate('/add')}
          className="mt-6 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-full font-semibold transition-colors"
        >
          Ajouter un contact
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6 px-2">Messages</h1>
      <div className="space-y-2">
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => navigate(`/chat/${chat.id}`)}
            className="flex items-center p-3 hover:bg-gray-900 rounded-2xl cursor-pointer transition-colors"
          >
            <div className="w-14 h-14 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg shrink-0 overflow-hidden">
              {chat.otherUser.photoUrl ? (
                <img src={chat.otherUser.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <>{chat.otherUser.firstName.charAt(0)}{chat.otherUser.lastName.charAt(0)}</>
              )}
            </div>
            <div className="ml-4 flex-1 overflow-hidden">
              <div className="flex justify-between items-baseline">
                <h3 className="font-semibold text-lg truncate">
                  {chat.otherUser.firstName} {chat.otherUser.lastName} {chat.otherUser.uid === user.uid && '(Moi)'}
                </h3>
                {chat.lastMessageAt && (
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {format(new Date(chat.lastMessageAt), 'HH:mm', { locale: fr })}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 truncate mt-0.5">
                {chat.lastMessage || 'Nouvelle discussion'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

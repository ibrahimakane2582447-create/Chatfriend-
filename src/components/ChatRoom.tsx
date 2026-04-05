import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Mic, Image as ImageIcon, Video, Send, Check, Palette } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function ChatRoom() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const themes = [
    { id: 'monochrome', name: 'Noir & Blanc', bg: 'bg-black', bubble: 'bg-white text-black', otherBubble: 'bg-gray-800 text-white' },
    { id: 'ocean', name: 'Océan', bg: 'bg-blue-950', bubble: 'bg-blue-600 text-white', otherBubble: 'bg-gray-800 text-white' },
    { id: 'forest', name: 'Forêt', bg: 'bg-green-950', bubble: 'bg-green-600 text-white', otherBubble: 'bg-gray-800 text-white' },
    { id: 'dusk', name: 'Crépuscule', bg: 'bg-purple-950', bubble: 'bg-purple-600 text-white', otherBubble: 'bg-gray-800 text-white' },
  ];

  useEffect(() => {
    if (!user || !chatId) return;

    // Fetch chat details
    const fetchChat = async () => {
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        setChat({ id: chatDoc.id, ...data });
        const otherId = data.participants.find((id: string) => id !== user.uid) || user.uid;
        if (otherId) {
          const userSnap = await getDoc(doc(db, 'users', otherId));
          if (userSnap.exists()) {
            setOtherUser({ uid: userSnap.id, ...userSnap.data() });
          }
        }
      }
    };
    fetchChat();

    // Listen to messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsubscribe();
  }, [chatId, user]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    const text = newMessage.trim();
    setNewMessage('');

    const now = new Date().toISOString();

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      chatId,
      senderId: user.uid,
      text,
      type: 'text',
      createdAt: now
    });

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: text,
      lastMessageAt: now
    });
  };

  const handleVoiceRecord = () => {
    setIsRecording(true);
    // Simulate recording
    setTimeout(() => {
      setIsRecording(false);
      // In a real app, we would upload the audio file to Storage and send the URL
      alert("L'enregistrement vocal n'est pas encore implémenté dans cette démo.");
    }, 2000);
  };

  const handlePointerDown = (text: string) => {
    timerRef.current = setTimeout(() => {
      navigator.clipboard.writeText(text);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }, 2000); // 2 seconds long press
  };

  const handlePointerUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const changeTheme = async (themeId: string) => {
    if (!chatId) return;
    await updateDoc(doc(db, 'chats', chatId), {
      theme: themeId
    });
    setChat((prev: any) => ({ ...prev, theme: themeId }));
    setShowThemeMenu(false);
  };

  const currentTheme = themes.find(t => t.id === (chat?.theme || 'monochrome')) || themes[0];

  return (
    <div className={`flex flex-col h-screen ${currentTheme.bg} text-white transition-colors duration-300 relative`}>
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-green-400" />
          Texte copié
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-md sticky top-0 z-10 border-b border-gray-800">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 mr-2 hover:bg-gray-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          {otherUser && (
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center font-bold text-sm shadow-md overflow-hidden">
                {otherUser.photoUrl ? (
                  <img src={otherUser.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{otherUser.firstName.charAt(0)}{otherUser.lastName.charAt(0)}</>
                )}
              </div>
              <div className="ml-3">
                <h2 className="font-semibold">{otherUser.firstName} {otherUser.lastName} {otherUser.uid === user?.uid && '(Moi)'}</h2>
                <p className="text-xs text-gray-400">ID: {otherUser.searchId}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="relative">
          <button onClick={() => setShowThemeMenu(!showThemeMenu)} className="p-2 hover:bg-gray-800 rounded-full transition-colors">
            <Palette className="w-5 h-5 text-gray-400" />
          </button>
          
          {showThemeMenu && (
            <div className="absolute top-12 right-0 bg-gray-900 border border-gray-800 rounded-xl shadow-xl p-2 w-48 z-20">
              <h3 className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase tracking-wider">Thèmes</h3>
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${chat?.theme === t.id ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
                >
                  {t.name}
                  {chat?.theme === t.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user?.uid;
          const showDate = index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          
          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="text-xs bg-gray-800 text-gray-400 px-3 py-1 rounded-full">
                    {format(new Date(msg.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </div>
              )}
              <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-4 py-2.5 select-none",
                    isMe 
                      ? `${currentTheme.bubble} rounded-tr-sm` 
                      : `${currentTheme.otherBubble} rounded-tl-sm`
                  )}
                  onPointerDown={() => handlePointerDown(msg.text)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p className={cn("text-[10px] mt-1 text-right", isMe ? "opacity-70" : "text-gray-400")}>
                    {format(new Date(msg.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - TikTok style (dark, sleek, floating icons) */}
      <div className="p-4 bg-gradient-to-t from-black via-black to-transparent pb-6">
        <div className="flex items-end gap-2 bg-gray-900 p-2 rounded-3xl border border-gray-800">
          <div className="flex gap-1 p-1">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
              <ImageIcon className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors">
              <Video className="w-5 h-5" />
            </button>
          </div>
          
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Envoyer un message..."
            className="flex-1 bg-transparent text-white max-h-32 min-h-[40px] py-2.5 px-2 resize-none focus:outline-none text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          
          <div className="p-1">
            {newMessage.trim() ? (
              <button 
                onClick={handleSend}
                className="p-2.5 bg-white text-black rounded-full hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onPointerDown={handleVoiceRecord}
                className={cn(
                  "p-2.5 rounded-full transition-all shadow-lg",
                  isRecording 
                    ? "bg-red-500 text-white animate-pulse shadow-red-500/50 scale-110" 
                    : "bg-gray-800 text-white hover:bg-gray-700 shadow-black/50"
                )}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

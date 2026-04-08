import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Mic, Image as ImageIcon, Video, Send, Check, CheckCheck, Clock, Palette, Trash2, Copy, X, Eye, EyeOff, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../lib/utils';
import CryptoJS from 'crypto-js';

// Helper for encryption
const encryptMessage = (text: string, secret: string) => {
  try {
    return CryptoJS.AES.encrypt(text, secret).toString();
  } catch (e) {
    return text;
  }
};

const decryptMessage = (ciphertext: string, secret: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext; // Fallback to original if decryption fails (e.g., old unencrypted messages)
  } catch (e) {
    return ciphertext;
  }
};

export default function ChatRoom() {
  const { chatId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chat, setChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [isContact, setIsContact] = useState(true);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob, url: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Media & View Once State
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const themes = [
    { id: 'light', name: 'Clair', bg: 'bg-slate-50', bubble: 'bg-blue-600 text-white', otherBubble: 'bg-white text-slate-900 border border-slate-200 shadow-sm' },
    { id: 'monochrome', name: 'Noir & Blanc', bg: 'bg-black', bubble: 'bg-white text-black', otherBubble: 'bg-gray-800 text-white' },
    { id: 'ocean', name: 'Océan', bg: 'bg-blue-950', bubble: 'bg-blue-600 text-white', otherBubble: 'bg-gray-800 text-white' },
    { id: 'forest', name: 'Forêt', bg: 'bg-green-950', bubble: 'bg-green-600 text-white', otherBubble: 'bg-gray-800 text-white' },
    { id: 'dusk', name: 'Crépuscule', bg: 'bg-purple-950', bubble: 'bg-purple-600 text-white', otherBubble: 'bg-gray-800 text-white' },
  ];

  useEffect(() => {
    if (!user || !chatId) return;

    // Set presence
    const chatRef = doc(db, 'chats', chatId);
    updateDoc(chatRef, {
      [`presence.${user.uid}`]: true
    }).catch(() => {});

    // Fetch chat details
    const fetchChat = async () => {
      const chatDoc = await getDoc(chatRef);
      if (chatDoc.exists()) {
        const data = chatDoc.data();
        setChat({ id: chatDoc.id, ...data });
        const otherId = data.participants.find((id: string) => id !== user.uid) || user.uid;
        if (otherId) {
          const userSnap = await getDoc(doc(db, 'users', otherId));
          if (userSnap.exists()) {
            const otherUserData = { uid: userSnap.id, ...userSnap.data() };
            setOtherUser(otherUserData);
            
            // Check if contact
            if (otherId !== user.uid) {
              const contactDoc = await getDoc(doc(db, 'users', user.uid, 'contacts', otherId));
              setIsContact(contactDoc.exists());
            }
          }
        }
      }
    };
    fetchChat();

    // Listen to chat updates for presence
    const unsubscribeChat = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        setChat({ id: doc.id, ...doc.data() });
      }
    });

    // Listen to messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeMessages = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const msgs = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as any;
        // Mark as read if from other user
        if (data.senderId !== user.uid && !data.read) {
          updateDoc(docSnapshot.ref, { read: true }).catch(() => {});
          // Also update chat document
          updateDoc(chatRef, { [`unreadCount.${user.uid}`]: 0 }).catch(() => {});
        }
        return {
          id: docSnapshot.id,
          ...data,
          isPending: docSnapshot.metadata.hasPendingWrites
        };
      });
      
      // Check for new messages for notification
      if (msgs.length > messages.length && messages.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg.senderId !== user.uid && !lastMsg.read && !lastMsg.isPending) {
          if (Notification.permission === 'granted') {
            new Notification('Nouveau message', {
              body: lastMsg.type === 'text' ? lastMsg.text : (lastMsg.type === 'audio' ? '🎤 Message vocal' : '📷 Média'),
              icon: '/pwa-192x192.png'
            });
          }
        }
      }
      
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      updateDoc(chatRef, {
        [`presence.${user.uid}`]: false
      }).catch(() => {});
      unsubscribeChat();
      unsubscribeMessages();
    };
  }, [chatId, user]);

  const handleAddContact = async () => {
    if (!user || !otherUser) return;
    await setDoc(doc(db, 'users', user.uid, 'contacts', otherUser.uid), {
      contactUid: otherUser.uid,
      addedAt: new Date().toISOString()
    });
    setIsContact(true);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

    const text = newMessage.trim();
    setNewMessage('');

    const now = new Date().toISOString();
    const encryptedText = encryptMessage(text, chatId);

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      chatId,
      senderId: user.uid,
      text: encryptedText,
      type: 'text',
      read: false,
      createdAt: now
    });

    await updateDoc(doc(db, 'chats', chatId), {
      lastMessage: encryptedText,
      lastMessageAt: now,
      lastMessageSenderId: user.uid,
      [`unreadCount.${otherUser?.uid || 'unknown'}`]: 1
    });
  };

  const handleVoiceRecordStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
        
        if (audioBlob.size > 0) {
          const url = URL.createObjectURL(audioBlob);
          setRecordedAudio({ blob: audioBlob, url });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      let time = 0;
      recordingTimerRef.current = setInterval(() => {
        time += 1;
        setRecordingTime(time);
      }, 1000);
      
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("Veuillez autoriser l'accès au microphone pour enregistrer des messages vocaux.");
    }
  };

  const handleVoiceRecordStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handleSendAudio = async () => {
    if (!recordedAudio || !user || !chatId) return;
    setUploading(true);
    try {
      const fileName = `chats/${chatId}/audio_${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, recordedAudio.blob);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const now = new Date().toISOString();
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        type: 'audio',
        mediaUrl: downloadUrl,
        read: false,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: '🎤 Message vocal',
        lastMessageAt: now,
        lastMessageSenderId: user.uid,
        [`unreadCount.${otherUser?.uid || 'unknown'}`]: 1
      });
      
      setRecordedAudio(null);
    } catch (error) {
      console.error("Error uploading audio", error);
    } finally {
      setUploading(false);
    }
  };

  const handleCancelAudio = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
    }
  };

  const handlePointerDown = (msg: any) => {
    timerRef.current = setTimeout(() => {
      setSelectedMessage(msg);
    }, 500); // 500ms long press
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSendMedia = async () => {
    if (!mediaFile || !user || !chatId) return;
    setUploading(true);
    try {
      const fileExt = mediaFile.name.split('.').pop();
      const fileName = `chats/${chatId}/${Date.now()}.${fileExt}`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, mediaFile);
      const downloadUrl = await getDownloadURL(storageRef);
      
      const now = new Date().toISOString();
      const type = mediaFile.type.startsWith('video/') ? 'video' : 'image';
      
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderId: user.uid,
        type,
        mediaUrl: downloadUrl,
        viewOnce: isViewOnce,
        viewed: false,
        read: false,
        createdAt: now
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isViewOnce ? '📷 Vue unique' : (type === 'image' ? '📷 Image' : '🎥 Vidéo'),
        lastMessageAt: now,
        lastMessageSenderId: user.uid,
        [`unreadCount.${otherUser?.uid || 'unknown'}`]: 1
      });

      setMediaFile(null);
      setMediaPreview('');
      setIsViewOnce(false);
    } catch (error) {
      console.error("Error uploading media", error);
    } finally {
      setUploading(false);
    }
  };

  const handleViewMedia = async (msg: any) => {
    if (msg.viewOnce && msg.senderId !== user?.uid && !msg.viewed) {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
        viewed: true
      });
    }
    setViewingMedia(msg);
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

      {/* Long Press Menu Modal */}
      {selectedMessage && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center pb-8 px-4" onClick={() => setSelectedMessage(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom-4" onClick={e => e.stopPropagation()}>
            {selectedMessage.type === 'text' && (
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedMessage.text);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 2000);
                  setSelectedMessage(null);
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 text-slate-700"
              >
                <Copy className="w-5 h-5" /> Copier le texte
              </button>
            )}
            {selectedMessage.senderId === user?.uid && (
              <button 
                onClick={async () => {
                  await deleteDoc(doc(db, 'chats', chatId, 'messages', selectedMessage.id));
                  setSelectedMessage(null);
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
              >
                <Trash2 className="w-5 h-5" /> Supprimer
              </button>
            )}
            <button onClick={() => setSelectedMessage(null)} className="w-full p-4 text-center text-slate-500 hover:bg-slate-100 transition-colors bg-slate-50 rounded-b-2xl font-medium">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Media Preview Modal (Before Sending) */}
      {/* Removed full screen modal, moved to inline preview above input */}

      {/* Viewing Media Modal (Full Screen) - Only for View Once now */}
      {viewingMedia && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col">
          <div className="p-4 flex justify-end absolute top-0 w-full z-10 bg-gradient-to-b from-black/50 to-transparent">
            <button onClick={() => setViewingMedia(null)} className="p-2 text-white drop-shadow-md">
              <X className="w-8 h-8" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            {viewingMedia.type === 'video' ? (
              <video src={viewingMedia.mediaUrl} controls autoPlay className="w-full h-full object-contain" />
            ) : (
              <img src={viewingMedia.mediaUrl} alt="Media" className="w-full h-full object-contain" />
            )}
          </div>
        </div>
      )}

      {/* Contact Info Modal */}
      {showContactInfo && otherUser && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4">
            <div className="p-4 flex justify-between items-center border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Infos du contact</h3>
              <button onClick={() => setShowContactInfo(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-700 shadow-sm mb-4 overflow-hidden">
                {otherUser.photoUrl ? (
                  <img src={otherUser.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{otherUser.firstName.charAt(0)}{otherUser.lastName.charAt(0)}</>
                )}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{otherUser.firstName} {otherUser.lastName}</h2>
              <p className="text-slate-500 font-mono mt-1">{otherUser.searchId}</p>
              
              <div className="w-full mt-6 space-y-4">
                {otherUser.address && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Adresse</p>
                    <p className="text-slate-900">{otherUser.address}</p>
                  </div>
                )}
                
                {otherUser.createdAt && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Inscrit(e) le</p>
                    <p className="text-slate-900">{format(new Date(otherUser.createdAt), 'dd MMMM yyyy', { locale: fr })}</p>
                  </div>
                )}
              </div>
              
              {!isContact && otherUser.uid !== user?.uid && (
                <button 
                  onClick={() => {
                    handleAddContact();
                    setShowContactInfo(false);
                  }}
                  className="w-full mt-6 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <UserPlus className="w-5 h-5" />
                  Ajouter aux contacts
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 shadow-sm">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 mr-2 hover:bg-slate-100 rounded-full transition-colors text-slate-700">
            <ArrowLeft className="w-6 h-6" />
          </button>
          {otherUser && (
            <div 
              className="flex items-center cursor-pointer hover:opacity-80" 
              onClick={() => setShowContactInfo(true)}
            >
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-700 text-sm shadow-sm overflow-hidden">
                {otherUser.photoUrl ? (
                  <img src={otherUser.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{otherUser.firstName.charAt(0)}{otherUser.lastName.charAt(0)}</>
                )}
              </div>
              <div className="ml-3">
                <h2 className="font-semibold flex items-center gap-2 text-slate-900">
                  {otherUser.firstName} {otherUser.lastName} {otherUser.uid === user?.uid && '(Moi)'}
                  {!isContact && otherUser.uid !== user?.uid && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
                      Inconnu
                    </span>
                  )}
                </h2>
                <p className={cn("text-xs", chat?.presence?.[otherUser.uid] ? "text-green-600 font-medium" : "text-slate-500")}>
                  {chat?.presence?.[otherUser.uid] ? '( en train de te regarder)' : `ID: ${otherUser.searchId}`}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="relative">
          <button onClick={() => setShowThemeMenu(!showThemeMenu)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-full transition-colors">
            <Palette className="w-5 h-5" />
          </button>
          
          {showThemeMenu && (
            <div className="absolute top-12 right-0 bg-white border border-slate-200 rounded-xl shadow-xl p-2 w-48 z-20">
              <h3 className="text-xs font-semibold text-slate-500 mb-2 px-2 uppercase tracking-wider">Thèmes</h3>
              {themes.map(t => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between ${chat?.theme === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                >
                  {t.name}
                  {chat?.theme === t.id && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Contact Banner */}
      {!isContact && otherUser && otherUser.uid !== user?.uid && (
        <div className="bg-gray-900 p-3 flex items-center justify-between border-b border-gray-800">
          <span className="text-sm text-gray-300">Ce contact n'est pas dans votre liste.</span>
          <button 
            onClick={handleAddContact}
            className="px-4 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-gray-200 flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" /> Ajouter
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user?.uid;
          const showDate = index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
          const isViewOnce = msg.viewOnce;
          const isViewed = msg.viewed;
          
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
                    "max-w-[75%] rounded-2xl px-4 py-2.5 select-none relative",
                    isMe 
                      ? `${currentTheme.bubble} rounded-tr-sm` 
                      : `${currentTheme.otherBubble} rounded-tl-sm`,
                    isViewOnce && !isMe && !isViewed && "cursor-pointer animate-pulse"
                  )}
                  onPointerDown={() => handlePointerDown(msg)}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  onClick={() => {
                    if (isViewOnce && !isMe && !isViewed) handleViewMedia(msg);
                  }}
                >
                  {msg.type === 'text' && <p className="text-sm break-words">{decryptMessage(msg.text, chatId || '')}</p>}
                  
                  {(msg.type === 'image' || msg.type === 'video') && (
                    <div className="flex flex-col items-center justify-center">
                      {isViewOnce ? (
                        <div className="flex items-center gap-2 py-2">
                          {isViewed ? <EyeOff className="w-5 h-5 opacity-50" /> : <Eye className="w-5 h-5" />}
                          <span className="text-sm font-medium">
                            {isMe ? (isViewed ? 'Ouvert' : 'Vue unique envoyée') : (isViewed ? 'Ouvert' : 'Appuyer pour voir')}
                          </span>
                        </div>
                      ) : (
                        msg.type === 'image' ? (
                          <img src={msg.mediaUrl} alt="Media" className="rounded-lg max-h-64 w-full object-cover" />
                        ) : (
                          <video src={msg.mediaUrl} controls className="rounded-lg max-h-64 w-full object-cover" />
                        )
                      )}
                    </div>
                  )}

                  {msg.type === 'audio' && (
                    <div className="flex items-center gap-2 py-1 min-w-[150px]">
                      <Mic className="w-4 h-4" />
                      <audio src={msg.mediaUrl} controls className="h-8 w-full max-w-[200px]" />
                    </div>
                  )}

                  <p className={cn("text-[10px] mt-1 text-right flex items-center justify-end gap-1", isMe ? "opacity-70" : "text-gray-400")}>
                    {format(new Date(msg.createdAt), 'HH:mm')}
                    {isMe && (
                      <span className="ml-1 flex items-center">
                        {msg.read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                        ) : msg.isPending ? (
                          <span className="font-bold tracking-widest">...</span>
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pb-6">
        {/* Inline Media Preview */}
        {mediaPreview && (
          <div className="mb-2 bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex items-end gap-2 relative">
            <button onClick={() => { setMediaPreview(''); setMediaFile(null); }} className="absolute -top-2 -left-2 bg-white rounded-full p-1 text-slate-500 hover:text-red-500 border border-slate-200 shadow-sm z-10">
              <X className="w-4 h-4" />
            </button>
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
              {mediaFile?.type.startsWith('video/') ? (
                <video src={mediaPreview} className="w-full h-full object-cover" />
              ) : (
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-2">
              <button 
                onClick={() => setIsViewOnce(!isViewOnce)} 
                className={cn("self-start px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors", isViewOnce ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                <Eye className="w-3.5 h-3.5" /> Vue unique
              </button>
            </div>
            <button 
              onClick={handleSendMedia}
              disabled={uploading}
              className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 shrink-0 shadow-sm"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex gap-1 p-1">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*,video/*" 
              className="hidden" 
            />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
              <ImageIcon className="w-5 h-5" />
            </button>
          </div>
          
          {recordedAudio ? (
            <div className="flex-1 flex items-center justify-between bg-blue-50 rounded-full px-4 py-1">
              <audio src={recordedAudio.url} controls className="h-8 w-full max-w-[150px]" />
              <button onClick={handleCancelAudio} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex-1 flex items-center justify-center text-red-500 font-mono text-sm animate-pulse">
              Enregistrement... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </div>
          ) : (
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Envoyer un message..."
              className="flex-1 bg-transparent text-slate-900 max-h-32 min-h-[40px] py-2.5 px-2 resize-none focus:outline-none text-sm placeholder-slate-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          )}
          
          <div className="p-1">
            {recordedAudio ? (
              <button 
                onClick={handleSendAudio}
                disabled={uploading}
                className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : newMessage.trim() ? (
              <button 
                onClick={handleSend}
                className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={isRecording ? handleVoiceRecordStop : handleVoiceRecordStart}
                className={cn(
                  "p-2.5 rounded-full transition-all shadow-sm",
                  isRecording 
                    ? "bg-red-500 text-white animate-pulse scale-110" 
                    : "bg-blue-100 text-blue-600 hover:bg-blue-200"
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

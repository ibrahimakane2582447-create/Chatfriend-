import React, { useState } from 'react';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, MessageSquare } from 'lucide-react';

export default function AddContact() {
  const { user, profile } = useAuth();
  const [searchId, setSearchId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId.trim()) return;
    
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const q = query(collection(db, 'users'), where('searchId', '==', searchId.trim()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("Aucun utilisateur trouvé avec ce numéro de recherche.");
      } else {
        const foundUser = querySnapshot.docs[0].data();
        setResult({ ...foundUser, isSelf: foundUser.uid === user?.uid });
      }
    } catch (err) {
      setError("Une erreur est survenue lors de la recherche.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!user || !result) return;
    setLoading(true);

    try {
      const isSelf = result.uid === user.uid;
      const participants = isSelf ? [user.uid] : [user.uid, result.uid];

      // Check if chat already exists
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', user.uid)
      );
      const chatsSnap = await getDocs(q);
      let existingChatId = null;

      chatsSnap.forEach((doc) => {
        const data = doc.data();
        if (isSelf) {
          if (data.participants.length === 1 && data.participants[0] === user.uid) {
            existingChatId = doc.id;
          }
        } else {
          if (data.participants.includes(result.uid) && data.participants.length === 2) {
            existingChatId = doc.id;
          }
        }
      });

      if (existingChatId) {
        navigate(`/chat/${existingChatId}`);
        return;
      }

      // Create new chat
      const chatRef = await addDoc(collection(db, 'chats'), {
        participants,
        lastMessage: '',
        lastMessageAt: new Date().toISOString()
      });

      // Add to contacts subcollection if it's not self
      if (!isSelf) {
        await setDoc(doc(db, 'users', user.uid, 'contacts', result.uid), {
          contactUid: result.uid,
          addedAt: new Date().toISOString()
        });
      }

      navigate(`/chat/${chatRef.id}`);
    } catch (err) {
      setError("Erreur lors de l'ajout du contact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col">
      <h1 className="text-2xl font-bold mb-6 px-2">Ajouter un contact</h1>
      
      <div className="bg-gray-900 p-4 rounded-2xl mb-6">
        <p className="text-sm text-gray-400 mb-2">Votre numéro de recherche :</p>
        <div className="text-2xl font-mono font-bold text-pink-500 tracking-wider">
          {profile?.searchId}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Partagez ce numéro avec vos amis pour qu'ils puissent vous trouver.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-6">
        <input
          type="text"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          placeholder="Entrez le numéro de recherche..."
          className="w-full bg-gray-900 text-white px-5 py-4 pl-12 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 transition-all font-mono"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <button
          type="submit"
          disabled={loading || !searchId.trim()}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-pink-600 hover:bg-pink-700 text-white p-2 rounded-full disabled:opacity-50 transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>
      </form>

      {error && (
        <div className="text-red-500 text-center p-4 bg-red-500/10 rounded-xl text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-gray-900 p-6 rounded-2xl flex flex-col items-center text-center mt-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="w-24 h-24 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4 overflow-hidden">
            {result.photoUrl ? (
              <img src={result.photoUrl} alt="Profil" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <>{result.firstName.charAt(0)}{result.lastName.charAt(0)}</>
            )}
          </div>
          <h3 className="text-xl font-bold">{result.firstName} {result.lastName}</h3>
          <p className="text-gray-400 text-sm mt-1 mb-2 font-mono">{result.searchId}</p>
          
          {result.isSelf && (
            <p className="text-pink-500 text-sm mb-4 bg-pink-500/10 px-3 py-1.5 rounded-full">
              C'est votre profil. Vous pouvez discuter avec vous-même.
            </p>
          )}
          
          <button
            onClick={handleAddContact}
            disabled={loading}
            className="w-full py-3 px-4 bg-pink-600 hover:bg-pink-700 text-white rounded-full font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
          >
            {result.isSelf ? <MessageSquare className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            {result.isSelf ? 'Notes personnelles' : 'Commencer à discuter'}
          </button>
        </div>
      )}
    </div>
  );
}

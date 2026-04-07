import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Image as ImageIcon, Video, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

export default function MyDay() {
  const { user, profile } = useAuth();
  const [stories, setStories] = useState<any[]>([]);
  const [groupedStories, setGroupedStories] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentViewIndex, setCurrentViewIndex] = useState(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  
  // Add Story State
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch stories that haven't expired
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', now)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedStories = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      
      // Group by user
      const grouped = new Map();
      for (const story of fetchedStories) {
        if (!grouped.has(story.userId)) {
          grouped.set(story.userId, {
            userId: story.userId,
            userProfile: null,
            stories: []
          });
        }
        grouped.get(story.userId).stories.push(story);
      }

      // Sort stories within each group by createdAt
      for (const group of grouped.values()) {
        group.stories.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }

      // Fetch user profiles
      const finalGroups = [];
      for (const group of grouped.values()) {
        if (group.userId === user.uid) {
          group.userProfile = profile;
        } else {
          const userSnap = await getDoc(doc(db, 'users', group.userId));
          if (userSnap.exists()) {
            group.userProfile = userSnap.data();
          }
        }
        if (group.userProfile) {
          finalGroups.push(group);
        }
      }

      // Put current user first if they have stories
      finalGroups.sort((a, b) => {
        if (a.userId === user.uid) return -1;
        if (b.userId === user.uid) return 1;
        return 0;
      });

      setGroupedStories(finalGroups);
    });

    return () => unsubscribe();
  }, [user, profile]);

  // Auto-advance stories
  useEffect(() => {
    if (!showViewModal || groupedStories.length === 0) return;

    const currentGroup = groupedStories[currentViewIndex];
    const currentStory = currentGroup.stories[currentStoryIndex];

    if (currentStory.mediaType === 'image') {
      const timer = setTimeout(() => {
        handleNextStory();
      }, 5000); // 5 seconds per image
      return () => clearTimeout(timer);
    }
  }, [showViewModal, currentViewIndex, currentStoryIndex, groupedStories]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && user) {
      const file = e.target.files[0];
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      
      setAdding(true);
      setShowAddModal(true); // Show loading state

      try {
        // 1. Upload file to Firebase Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `stories/${user.uid}_${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, fileName);
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        // 2. Save to Firestore
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours

        await addDoc(collection(db, 'stories'), {
          userId: user.uid,
          mediaUrl: downloadUrl,
          mediaType: type,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString()
        });

      } catch (error: any) {
        console.error("Error adding story:", error);
        alert("Erreur lors de l'ajout de la story.");
      } finally {
        setAdding(false);
        setShowAddModal(false);
      }
    }
  };

  const openStory = (groupIndex: number) => {
    setCurrentViewIndex(groupIndex);
    setCurrentStoryIndex(0);
    setShowViewModal(true);
  };

  const handleNextStory = () => {
    const currentGroup = groupedStories[currentViewIndex];
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else if (currentViewIndex < groupedStories.length - 1) {
      setCurrentViewIndex(prev => prev + 1);
      setCurrentStoryIndex(0);
    } else {
      setShowViewModal(false);
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else if (currentViewIndex > 0) {
      setCurrentViewIndex(prev => prev - 1);
      setCurrentStoryIndex(groupedStories[currentViewIndex - 1].stories.length - 1);
    }
  };

  const hasMyStory = groupedStories.some(g => g.userId === user?.uid);

  return (
    <div className="py-4 border-b border-slate-200 bg-white">
      <div className="flex overflow-x-auto px-4 gap-4 no-scrollbar">
        {/* Add Story Button */}
        <div className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="relative w-16 h-16 rounded-full p-[2px] bg-slate-200">
            <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
              {adding ? (
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-600"></div>
              ) : profile?.photoUrl ? (
                <img src={profile.photoUrl} alt="Me" className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-xl font-bold text-slate-400">{profile?.firstName.charAt(0)}</span>
              )}
            </div>
            {!adding && (
              <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1 border-2 border-white shadow-sm">
                <Plus className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">{adding ? 'Envoi...' : 'Ajouter'}</span>
        </div>
        
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*,video/*" 
          className="hidden" 
        />

        {/* Stories List */}
        {groupedStories.map((group, index) => (
          <div key={group.userId} className="flex flex-col items-center gap-1 shrink-0 cursor-pointer" onClick={() => openStory(index)}>
            <div className={`w-16 h-16 rounded-full p-[2px] ${group.userId === user?.uid ? 'bg-slate-300' : 'bg-blue-600'}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-700">
                {group.userProfile?.photoUrl ? (
                  <img src={group.userProfile.photoUrl} alt={group.userProfile.firstName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <>{group.userProfile?.firstName.charAt(0)}{group.userProfile?.lastName.charAt(0)}</>
                )}
              </div>
            </div>
            <span className="text-xs text-slate-700 font-medium truncate w-16 text-center">
              {group.userId === user?.uid ? 'Mon statut' : group.userProfile?.firstName}
            </span>
          </div>
        ))}
      </div>

      {/* View Story Modal */}
      {showViewModal && groupedStories.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Progress Bars */}
          <div className="flex gap-1 p-2 pt-4 absolute top-0 w-full z-10 bg-gradient-to-b from-black/50 to-transparent">
            {groupedStories[currentViewIndex].stories.map((_, idx) => (
              <div key={idx} className="h-1 flex-1 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-white ${idx === currentStoryIndex ? 'animate-[progress_5s_linear_forwards]' : idx < currentStoryIndex ? 'w-full' : 'w-0'}`}
                  style={{ animationPlayState: groupedStories[currentViewIndex].stories[currentStoryIndex].mediaType === 'video' ? 'paused' : 'running' }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-8 w-full px-4 flex justify-between items-center z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800">
                {groupedStories[currentViewIndex].userProfile?.photoUrl ? (
                  <img src={groupedStories[currentViewIndex].userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-700 text-white font-bold">
                    {groupedStories[currentViewIndex].userProfile?.firstName.charAt(0)}
                  </div>
                )}
              </div>
              <span className="font-semibold text-white shadow-black drop-shadow-md">
                {groupedStories[currentViewIndex].userProfile?.firstName} {groupedStories[currentViewIndex].userProfile?.lastName}
              </span>
            </div>
            <button onClick={() => setShowViewModal(false)} className="p-2 text-white drop-shadow-md">
              <X className="w-8 h-8" />
            </button>
          </div>

          {/* Media Content */}
          <div className="flex-1 relative flex items-center justify-center bg-black">
            {groupedStories[currentViewIndex].stories[currentStoryIndex].mediaType === 'video' ? (
              <video 
                src={groupedStories[currentViewIndex].stories[currentStoryIndex].mediaUrl} 
                className="w-full h-full object-contain"
                autoPlay 
                playsInline
                onEnded={handleNextStory}
              />
            ) : (
              <img 
                src={groupedStories[currentViewIndex].stories[currentStoryIndex].mediaUrl} 
                alt="Story" 
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            )}

            {/* Navigation Overlays */}
            <div className="absolute inset-0 flex">
              <div className="w-1/3 h-full" onClick={handlePrevStory} />
              <div className="w-2/3 h-full" onClick={handleNextStory} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

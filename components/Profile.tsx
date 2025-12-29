
import React, { useState, useRef, useEffect } from 'react';
import { User, Book } from '../types';
import { MapPin, Calendar, Edit3, Save, BookOpen, Award, Flame, Camera, ShieldAlert, Trash2, Lock } from 'lucide-react';
import { db, UserData } from '../services/db';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  books: Book[];
}

const ACHIEVEMENTS = [
  { id: 1, icon: '🐛', title: 'Bookworm', desc: 'Read 10 books', unlocked: true },
  { id: 2, icon: '🔥', title: 'On Fire', desc: '7 day streak', unlocked: true },
  { id: 3, icon: '✍️', title: 'Critic', desc: 'Wrote 5 reviews', unlocked: true },
  { id: 4, icon: '🏰', title: 'Fantasy Fan', desc: 'Read 5 fantasy books', unlocked: false },
];

const ADMIN_EMAIL = 'nme030609@gmail.com';

export const Profile: React.FC<ProfileProps> = ({ user, onUpdateUser, books }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState(user.name);
  const [editBio, setEditBio] = useState(user.bio || '');
  const [editLocation, setEditLocation] = useState(user.location || '');

  const [allUsers, setAllUsers] = useState<UserData[]>([]);
  const isAdmin = user.handle === ADMIN_EMAIL;

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const completedBooksCount = books.filter(b => b.status === 'completed').length;
  const realTotalRead = completedBooksCount; 
  const yearlyGoal = 20;

  useEffect(() => {
      if (isAdmin) {
          loadAllUsers();
      }
  }, [isAdmin]);

  const loadAllUsers = async () => {
      try {
          const users = await db.getAllUsersData();
          setAllUsers(users);
      } catch (e) {
          console.error("Failed to load users", e);
      }
  };

  const handleSave = async () => {
    const updatedUser = {
      ...user,
      name: editName,
      bio: editBio,
      location: editLocation
    };
    
    onUpdateUser(updatedUser); 
    await db.updateUserProfile(updatedUser); 
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'avatar' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        const updatedUser = {
            ...user,
            [field]: result
        };
        onUpdateUser(updatedUser);
        await db.updateUserProfile(updatedUser);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
          try {
              await db.deleteUser(id);
              setAllUsers(prev => prev.filter(u => u.id !== id));
          } catch (e) {
              alert("Failed to delete user");
          }
      }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <div className="relative w-full h-64 rounded-3xl overflow-hidden shadow-sm mb-16 group bg-stone-200 dark:bg-stone-800">
        <img src={user.bannerUrl} alt="Cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        {isEditing && (
            <>
                <button 
                    onClick={() => bannerInputRef.current?.click()}
                    className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-white/30 transition-all cursor-pointer z-10"
                >
                    <Camera size={16} />
                    <span>Change Cover</span>
                </button>
                <input 
                    type="file" 
                    ref={bannerInputRef} 
                    hidden 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'bannerUrl')}
                />
            </>
        )}
      </div>

      <div className="px-6 relative">
        <div className="absolute -top-24 left-6 sm:left-10">
          <div className="relative group">
            <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white dark:border-stone-900 shadow-lg overflow-hidden bg-white dark:bg-stone-800">
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            </div>
            {isEditing && (
                <>
                    <div 
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                    >
                        <Camera className="text-white" />
                    </div>
                    <input 
                        type="file" 
                        ref={avatarInputRef} 
                        hidden 
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'avatar')}
                    />
                </>
            )}
          </div>
        </div>

        <div className="flex justify-end mb-6">
            {isEditing ? (
                <div className="flex gap-3">
                    <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 font-medium hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-6 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-medium hover:bg-stone-800 dark:hover:bg-stone-200 transition-colors flex items-center gap-2 shadow-lg"
                    >
                        <Save size={18} />
                        Save Profile
                    </button>
                </div>
            ) : (
                <button 
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium hover:bg-white dark:hover:bg-stone-800 hover:shadow-md hover:border-stone-300 dark:hover:border-stone-600 transition-all flex items-center gap-2 bg-white/50 dark:bg-stone-800/50 backdrop-blur-sm"
                >
                    <Edit3 size={18} />
                    Edit Profile
                </button>
            )}
        </div>

        <div className="mt-4 sm:ml-48 mb-10">
            {isEditing ? (
                <div className="space-y-4 max-w-lg animate-fade-in-up">
                    <div>
                        <label className="text-xs font-bold text-stone-400 uppercase">Name</label>
                        <input 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 bg-transparent border-b-2 border-stone-200 dark:border-stone-700 focus:border-stone-800 dark:focus:border-stone-200 outline-none pb-1"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-stone-400 uppercase">Bio</label>
                        <textarea 
                            value={editBio} 
                            onChange={(e) => setEditBio(e.target.value)}
                            className="w-full text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800 p-3 rounded-xl border border-stone-200 dark:border-stone-700 focus:ring-2 focus:ring-stone-200 dark:focus:ring-stone-600 outline-none resize-none"
                            rows={3}
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold text-stone-400 uppercase">Location</label>
                        <input 
                            value={editLocation} 
                            onChange={(e) => setEditLocation(e.target.value)}
                            className="w-full text-stone-600 dark:text-stone-300 bg-transparent border-b border-stone-200 dark:border-stone-700 focus:border-stone-800 dark:focus:border-stone-200 outline-none py-1"
                        />
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in-up">
                    <h1 className="text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-3">
                        {user.name} 
                        {(user.streakDays || 0) > 0 && (
                            <span className="text-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full flex items-center gap-1 font-sans font-bold border border-orange-200 dark:border-orange-800" title="Current Streak">
                                <Flame size={14} fill="currentColor" /> {user.streakDays}
                            </span>
                        )}
                        {isAdmin && (
                            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-md font-sans font-bold border border-red-200 dark:border-red-800 flex items-center gap-1">
                                <ShieldAlert size={12} /> Admin
                            </span>
                        )}
                    </h1>
                    <p className="text-stone-400 font-medium mb-4">{user.handle}</p>
                    <p className="text-stone-700 dark:text-stone-300 text-lg leading-relaxed max-w-2xl mb-4">{user.bio}</p>
                    
                    <div className="flex flex-wrap gap-6 text-sm text-stone-500 dark:text-stone-400">
                        {user.location && (
                            <div className="flex items-center gap-1.5">
                                <MapPin size={16} />
                                {user.location}
                            </div>
                        )}
                        <div className="flex items-center gap-1.5">
                            <Calendar size={16} />
                            Joined {user.joinedDate}
                        </div>
                    </div>
                </div>
            )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center">
                    <BookOpen size={24} />
                </div>
                <div>
                    <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">Total Books</p>
                    <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{realTotalRead}</p>
                </div>
            </div>
            <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center">
                    <Award size={24} />
                </div>
                <div>
                    <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">Yearly Goal</p>
                    <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{completedBooksCount} <span className="text-sm text-stone-400 font-normal">/ {yearlyGoal}</span></p>
                </div>
            </div>
            <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center">
                    <Flame size={24} />
                </div>
                <div>
                    <p className="text-stone-500 dark:text-stone-400 text-sm font-medium">Current Streak</p>
                    <p className="text-2xl font-bold text-stone-800 dark:text-stone-100">{(user.streakDays || 0) > 0 ? user.streakDays : 0} Days</p>
                </div>
            </div>
        </div>

        <div className="mb-10">
            <h3 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-100 mb-6">Achievements</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {ACHIEVEMENTS.map((ach) => (
                    <div 
                        key={ach.id} 
                        className={`p-4 rounded-2xl border transition-all duration-300 ${
                            ach.unlocked 
                            ? 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700 shadow-sm hover:shadow-md' 
                            : 'bg-stone-50 dark:bg-stone-800 border-stone-100 dark:border-stone-700 opacity-60 grayscale'
                        }`}
                    >
                        <div className="text-4xl mb-3">{ach.icon}</div>
                        <h4 className="font-bold text-stone-800 dark:text-stone-100">{ach.title}</h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400">{ach.desc}</p>
                    </div>
                ))}
            </div>
        </div>

        {isAdmin && (
             <div className="mb-20 animate-fade-in-up border-t-2 border-stone-100 dark:border-stone-800 pt-10">
                 <div className="flex items-center gap-3 mb-6">
                    <ShieldAlert className="text-red-500" size={32} />
                    <div>
                        <h3 className="font-serif font-bold text-2xl text-stone-800 dark:text-stone-100">Admin Panel</h3>
                        <p className="text-stone-500 text-sm">User Management Database</p>
                    </div>
                 </div>

                 <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
                     <div className="overflow-x-auto">
                         <table className="w-full text-left">
                             <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 font-medium text-xs uppercase tracking-wider">
                                 <tr>
                                     <th className="px-6 py-4">User</th>
                                     <th className="px-6 py-4">Email</th>
                                     <th className="px-6 py-4">Password</th>
                                     <th className="px-6 py-4 text-right">Actions</th>
                                 </tr>
                             </thead>
                             <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                 {allUsers.map((u) => (
                                     <tr key={u.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                                         <td className="px-6 py-4">
                                             <div className="flex items-center gap-3">
                                                 <img src={u.profile.avatar} className="w-8 h-8 rounded-full object-cover" alt="" />
                                                 <span className="font-medium text-stone-800 dark:text-stone-200">{u.profile.name}</span>
                                             </div>
                                         </td>
                                         <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400">
                                             {u.email}
                                         </td>
                                         <td className="px-6 py-4 font-mono text-sm text-stone-500">
                                            {u.email === ADMIN_EMAIL ? (
                                                <span className="flex items-center gap-1 text-stone-400 italic">
                                                    <Lock size={12} /> Hidden
                                                </span>
                                            ) : (
                                                u.password
                                            )}
                                         </td>
                                         <td className="px-6 py-4 text-right">
                                             {u.email !== ADMIN_EMAIL && (
                                                <button 
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    className="text-stone-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                    title="Delete User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                             )}
                                         </td>
                                     </tr>
                                 ))}
                             </tbody>
                         </table>
                     </div>
                     {allUsers.length === 0 && (
                         <div className="p-8 text-center text-stone-400 italic">Loading users...</div>
                     )}
                 </div>
             </div>
        )}
      </div>
    </div>
  );
};

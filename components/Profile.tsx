
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Book } from '../types';
import { Edit3, History, BarChart3, Award, BookOpen, Loader2, Lock, Camera, Image as ImageIcon, X, Check, Trash2, ShieldCheck, Flag } from 'lucide-react';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';
import { ModerationDialog } from './ModerationDialog';
import { ErrorNotice } from './ErrorNotice';

interface ProfileProps {
  user: User;
  onUpdateUser: (user: User) => void;
  books: Book[];
  viewingUserId?: string;
  onNavigate?: (tab: string) => void;
  onAccountDeleted?: () => void;
}

interface Achievement {
    id: string;
    icon: string;
    title: string;
    desc: string;
    isUnlocked: boolean;
    progress?: number;
    goal: number;
}

export const Profile: React.FC<ProfileProps> = ({
  user: currentUser,
  onUpdateUser,
  books: currentBooks,
  viewingUserId,
  onNavigate,
  onAccountDeleted,
}) => {
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser.id;
  
  const [profileUser, setProfileUser] = useState<User>(currentUser);
  const profileBooks = isOwnProfile ? currentBooks : [];
  const [loadedProfileId, setLoadedProfileId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<{ id: string; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [activeTab, setActiveTab] = useState<'info' | 'stats' | 'achievements'>('info');
  const [isEditing, setIsEditing] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveLock = useRef(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isModerationOpen, setIsModerationOpen] = useState(false);

  const fileInputAvatarRef = useRef<HTMLInputElement>(null);
  const fileInputBannerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOwnProfile) {
        setProfileUser(currentUser);
        setEditName(currentUser.name);
        setEditBio(currentUser.bio || '');
        setEditLocation(currentUser.location || '');
    }
  }, [isOwnProfile, currentUser]);

  useEffect(() => {
    setActiveTab('info');
    setIsEditing(false);
    if (isOwnProfile || !viewingUserId) return;
    let cancelled = false;
    setLoadedProfileId(null);
    setProfileError(null);
    void db.getPublicProfile(viewingUserId).then(profile => {
      if (cancelled) return;
      setProfileUser(profile);
      setLoadedProfileId(viewingUserId);
    }).catch(() => {
      if (!cancelled) setProfileError({ id: viewingUserId, message: 'Профиль недоступен или не удалось его загрузить.' });
    });
    return () => { cancelled = true; };
  }, [viewingUserId, isOwnProfile, retryCount]);

  const completedBooks = useMemo(() => profileBooks.filter(b => b.status === 'completed'), [profileBooks]);
  const totalPagesRead = profileBooks.reduce((acc, book) => acc + (book.progress > 0 ? book.currentPage || 0 : 0), 0);
  const totalAnnotations = useMemo(() => profileBooks.reduce((acc, b) => acc + (b.annotationCount ?? b.annotations?.length ?? 0), 0), [profileBooks]);

  const achievements = useMemo((): Achievement[] => [
    { id: 'bookworm', icon: '🐛', title: 'Книжный червь', desc: 'Прочитать 5 книг', goal: 5, progress: completedBooks.length, isUnlocked: completedBooks.length >= 5 },
    { id: 'thinker', icon: '🧠', title: 'Мыслитель', desc: 'Создать 10 заметок', goal: 10, progress: totalAnnotations, isUnlocked: totalAnnotations >= 10 },
  ], [completedBooks, totalAnnotations]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    if (saveLock.current) return;
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Файл слишком большой. Пожалуйста, выберите изображение меньше 5MB.");
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfileUser(prev => ({
          ...prev,
          [type === 'avatar' ? 'avatar' : 'bannerUrl']: result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (saveLock.current) return;
    if (!editName.trim()) {
      setSaveError('Укажите имя профиля.');
      return;
    }
    saveLock.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updatedUser = { ...profileUser, name: editName.trim(), bio: editBio, location: editLocation };
      await db.updateUserProfile(updatedUser); 
      onUpdateUser(updatedUser);
      setProfileUser(updatedUser);
      setIsEditing(false);
    } catch (e) {
      console.error("Failed to save profile", e);
      setSaveError('Не удалось сохранить профиль. Изменения остались в форме — проверьте соединение и попробуйте ещё раз.');
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    if (saveLock.current) return;
    setSaveError(null);
    setProfileUser(currentUser); // Revert image changes
    setEditName(currentUser.name);
    setEditBio(currentUser.bio || '');
    setEditLocation(currentUser.location || '');
    setIsEditing(false);
  }

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await db.deleteAccount();
      setIsDeleteDialogOpen(false);
      onAccountDeleted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось удалить аккаунт';
      setDeleteError(message);
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (!isOwnProfile && profileError?.id === viewingUserId) return (
    <ErrorNotice message={profileError.message} onRetry={() => setRetryCount(count => count + 1)} />
  );

  if (!isOwnProfile && loadedProfileId !== viewingUserId) return (
      <div className="flex flex-col items-center justify-center min-h-[500px] animate-fade-in"><Loader2 className="animate-spin text-amber-500 mb-4" size={40} /></div>
  );

  return (
    <div className="max-w-5xl mx-auto pb-12 animate-fade-in-up">
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Удалить аккаунт навсегда?"
        message="Будут удалены профиль, библиотека, заметки, публикации, комментарии и ответы. Отменить это действие нельзя."
        confirmLabel="Удалить аккаунт"
        isConfirming={isDeletingAccount}
        onConfirm={handleDeleteAccount}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
      <ModerationDialog
        currentUser={currentUser}
        target={isModerationOpen ? {
          contentType: 'user',
          userId: profileUser.id,
          userName: profileUser.name,
        } : null}
        onBlocked={() => {
          setIsModerationOpen(false);
          onNavigate?.('board');
        }}
        onClose={() => setIsModerationOpen(false)}
      />
      <input type="file" disabled={isSaving} ref={fileInputBannerRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} />
      <input type="file" disabled={isSaving} ref={fileInputAvatarRef} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'avatar')} />

      {/* Banner Section */}
      <div className="relative w-full h-44 sm:h-64 mb-20 sm:mb-24 group">
        <div className={`absolute inset-0 rounded-[3rem] overflow-hidden shadow-2xl bg-stone-200 dark:bg-stone-800 transition-all ${isEditing ? 'ring-4 ring-amber-500/50' : ''}`}>
            <img src={profileUser.bannerUrl || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=2070&auto=format&fit=crop"} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
        
        {isEditing && (
          <button 
            disabled={isSaving}
            onClick={() => fileInputBannerRef.current?.click()}
            className="absolute top-6 right-6 bg-black/50 backdrop-blur-md text-white p-3 rounded-2xl hover:bg-black/70 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest shadow-lg border border-white/10 z-30"
          >
            <ImageIcon size={18} /> Изменить обложку
          </button>
        )}

        {/* Avatar Section */}
        <div className="absolute -bottom-12 sm:-bottom-16 left-5 sm:left-10 z-20 group/avatar">
            <div className={`w-28 h-28 sm:w-40 sm:h-40 rounded-[2.5rem] border-[6px] border-stone-50 dark:border-stone-950 shadow-2xl overflow-hidden bg-white dark:bg-stone-800 relative ${isEditing ? 'cursor-pointer' : ''}`}>
              <img src={profileUser.avatar} alt={profileUser.name} className="w-full h-full object-cover" />
              {isEditing && (
                <button
                  type="button"
                  aria-label="Изменить аватар"
                  disabled={isSaving}
                  onClick={() => fileInputAvatarRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                >
                  <Camera size={32} className="text-white" />
                </button>
              )}
            </div>
            {isEditing && (
               <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[9px] px-3 py-1 rounded-full font-bold uppercase tracking-widest shadow-lg whitespace-nowrap">
                  Изменить
               </div>
            )}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
        <div className="min-w-0 xl:col-span-8">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                <div className="w-full min-w-0 flex-1 max-w-2xl">
                    {isEditing ? (
                        <div className="space-y-4 animate-fade-in-up">
                            <div>
                              <label htmlFor="profile-name" className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Имя</label>
                              <input id="profile-name" disabled={isSaving} value={editName} onChange={(e) => setEditName(e.target.value)} className="text-4xl font-serif font-black text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-amber-500/50" placeholder="Ваше имя" />
                            </div>
                            <div>
                               <label htmlFor="profile-bio" className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">О себе</label>
                               <textarea id="profile-bio" disabled={isSaving} value={editBio} onChange={(e) => setEditBio(e.target.value)} className="text-base text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-3 w-full outline-none focus:ring-2 focus:ring-amber-500/50 resize-none h-24" placeholder="О себе" />
                            </div>
                            <div>
                               <label htmlFor="profile-location" className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1 block">Локация</label>
                               <input id="profile-location" disabled={isSaving} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="text-sm font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-amber-500/50" placeholder="Город, Страна" />
                            </div>
                            {saveError && <ErrorNotice message={saveError} />}
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100 mb-2 flex items-center gap-3 flex-wrap">
                              {profileUser.name}
                              {profileUser.role === 'admin' && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 font-sans text-xs font-bold tracking-normal text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  <ShieldCheck size={16} /> Администратор
                                </span>
                              )}
                            </h1>
                            <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-xs mb-4">{profileUser.handle}{profileUser.location && ` · ${profileUser.location}`}</p>
                            {profileUser.bio && <p className="text-lg text-stone-600 dark:text-stone-300 leading-relaxed max-w-xl">«{profileUser.bio}»</p>}
                        </>
                    )}
                </div>
                {isOwnProfile ? (
                    isEditing ? (
                        <div className="flex shrink-0 flex-wrap gap-3">
                          <button onClick={cancelEdit} disabled={isSaving} className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"><X size={16}/> Отмена</button>
                          <button onClick={handleSave} disabled={isSaving} className="px-8 py-3 rounded-2xl bg-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-xl shadow-amber-500/20 hover:scale-105 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                             {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 
                             Сохранить
                          </button>
                        </div>
                    ) : (
                        <button aria-label="Редактировать профиль" onClick={() => setIsEditing(true)} className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-all hover:scale-110 shadow-sm"><Edit3 size={20}/></button>
                    )
                ) : currentUser.id !== 'guest' ? (
                    <button
                      type="button"
                      onClick={() => setIsModerationOpen(true)}
                      className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-900 text-stone-400 hover:text-amber-600 transition-all hover:scale-110 shadow-sm"
                      aria-label="Пожаловаться или заблокировать пользователя"
                    >
                      <Flag size={20} />
                    </button>
                ) : null}
            </div>

            <div className="flex flex-wrap border-b border-stone-100 dark:border-stone-800 mb-8 gap-x-4 gap-y-2 pb-1">
                {[{ id: 'info', label: 'Обзор', icon: History }, ...(isOwnProfile ? [{ id: 'stats', label: 'Статистика', icon: BarChart3 }, { id: 'achievements', label: 'Достижения', icon: Award }] : [])].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`pb-4 px-2 text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 relative whitespace-nowrap ${activeTab === tab.id ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 hover:text-stone-600'}`}><tab.icon size={16} /> {tab.label}{activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 dark:bg-stone-100 rounded-full animate-scale-in" />}</button>
                ))}
            </div>

            {activeTab === 'info' && (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[2.5rem] text-white flex flex-col justify-between group overflow-hidden relative border border-stone-800"><BookOpen size={100} className="absolute -bottom-8 -right-8 opacity-10" /><div className="relative z-10"><h4 className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">Уровень читателя</h4><p className="text-5xl font-black">{profileUser.level}</p></div></div>
                        <div className="p-8 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm flex flex-col justify-between group overflow-hidden relative"><div className="relative z-10"><h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Прочитано</h4><p className="text-5xl font-black text-stone-900 dark:text-white">{isOwnProfile ? completedBooks.length : profileUser.totalBooksRead || 0}</p></div></div>
                    </div>
                </div>
            )}

            {isOwnProfile && activeTab === 'stats' && (
                <div className="p-8 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 space-y-4">
                    <h4 className="sr-only">Библиотека</h4>
                    <p className="text-stone-500">Книги: {profileBooks.length}</p>
                    <p className="text-stone-500">Читаю: {profileBooks.filter(book => book.status === 'reading').length}</p>
                    <p className="text-stone-500">Позиции в книгах: {totalPagesRead} стр.</p>
                    <p className="text-stone-500">Заметки: {totalAnnotations}</p>
                </div>
            )}

            {isOwnProfile && activeTab === 'achievements' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in-up">
                    {achievements.map((ach) => (
                        <div key={ach.id} className={`p-5 sm:p-8 rounded-[2.5rem] border transition-all duration-500 flex gap-4 items-center group relative overflow-hidden ${ach.isUnlocked ? 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-xl' : 'bg-stone-50/50 dark:bg-stone-900/30 border-dashed border-stone-200 dark:border-stone-800 opacity-60 grayscale'}`}>
                            {/* Lock icon correctly used here after import fix */}
                            <div className="text-5xl shrink-0 filter group-hover:scale-110 transition-transform relative z-10">{ach.isUnlocked ? ach.icon : <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-2xl"><Lock size={24} className="text-stone-400" /></div>}</div>
                            <div className="flex-1 min-w-0 relative z-10"><h4 className="font-serif font-bold text-lg text-stone-800 dark:text-stone-100 leading-tight mb-1">{ach.title}</h4><p className="text-xs text-stone-500 dark:text-stone-400 font-medium">{ach.desc}</p>{ach.isUnlocked && <span className="sr-only">Получено</span>}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="min-w-0 xl:col-span-4 space-y-6">
            <div className="p-8 bg-stone-900 dark:bg-stone-950 rounded-[3rem] text-white border border-stone-800 overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10"><BookOpen size={120} /></div>
                <div className="relative z-10"><h5 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Опыт</h5><p className="text-4xl font-black">{profileUser.xp} / 1000</p></div>
            </div>
            {isOwnProfile && (
              <section id="account-deletion" className="p-7 bg-white dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <ShieldCheck size={18} className="text-stone-400" />
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Аккаунт</h5>
                </div>
                {deleteError && (
                  <p className="mb-4 text-xs text-red-600 dark:text-red-400" role="alert">{deleteError}</p>
                )}
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isDeletingAccount}
                  className="w-full px-4 py-3 rounded-2xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} /> Удалить аккаунт
                </button>
                <div className="mt-4 flex flex-wrap justify-center gap-3 text-[10px] text-stone-400">
                  <a href="/privacy.html" target="_blank" rel="noreferrer" className="hover:text-stone-700 dark:hover:text-stone-200">Конфиденциальность</a>
                  <a href="/account-deletion.html" target="_blank" rel="noreferrer" className="hover:text-stone-700 dark:hover:text-stone-200">Подробнее</a>
                </div>
              </section>
            )}
        </div>
      </div>
    </div>
  );
};

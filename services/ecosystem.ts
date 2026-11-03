export type Product = 'books' | 'watch';
export const PRODUCTS = [
  { id: 'books' as const, name: 'B.Nook', description: 'Книги и мысли' },
  { id: 'watch' as const, name: 'W.Nook', description: 'Видео вместе' },
];

export function initialDestination(search: string, savedProduct: string | null, savedTab: string | null) {
  const params = new URLSearchParams(search);
  const roomId = params.get('room')?.trim() || null;
  const product: Product = params.get('app') === 'books' ? 'books' : roomId || params.get('app') === 'watch' ? 'watch'
    : savedProduct === 'watch' || (savedProduct !== 'books' && savedTab?.startsWith('watch-')) ? 'watch' : 'books';
  const tab = savedTab === 'feed' ? 'board' : savedTab;
  const valid = product === 'books' ? ['home', 'library', 'board', 'profile'] : ['watch-home', 'watch-rooms', 'profile'];
  return { product, roomId: product === 'watch' ? roomId : null,
    tab: roomId && product === 'watch' ? 'watch-home' : tab && valid.includes(tab) ? tab : product === 'watch' ? 'watch-home' : 'home' };
}

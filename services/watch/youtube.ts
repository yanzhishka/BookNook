export interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; seekTo(seconds: number, ahead: boolean): void;
  getCurrentTime(): number; getDuration(): number; getPlayerState(): number;
  getPlaybackRate(): number; setPlaybackRate(rate: number): void; getAvailablePlaybackRates(): number[];
  setVolume(volume: number): void; mute(): void; unMute(): void; destroy(): void;
}
interface YouTubeAPI { Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer }
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
const pending = new WeakMap<Window, Promise<YouTubeAPI>>();

export function loadYouTube(target: Window = window): Promise<YouTubeAPI> {
  if (target.YT?.Player) return Promise.resolve(target.YT);
  const existing = pending.get(target);
  if (existing) return existing;
  const request = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = target.document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api'; script.async = true;
    const previous = target.onYouTubeIframeAPIReady;
    const cleanup = () => { target.clearTimeout(timeout); target.onYouTubeIframeAPIReady = previous; };
    const fail = () => { cleanup(); script.remove(); pending.delete(target); reject(new Error('YouTube не ответил. Обновите страницу или выберите другое видео.')); };
    const timeout = target.setTimeout(fail, 15000);
    script.onerror = fail;
    target.onYouTubeIframeAPIReady = () => { cleanup(); previous?.(); if (target.YT) resolve(target.YT); else fail(); };
    target.document.head.append(script);
  });
  pending.set(target, request);
  return request;
}

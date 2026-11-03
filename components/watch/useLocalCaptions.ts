import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSubtitles, subtitlesVtt, type SubtitleCue } from '../../services/watch/subtitles';

export function useLocalCaptions(source: string) {
  const [file, setFile] = useState<{ name: string; cues: SubtitleCue[] } | null>(null);
  const [enabled, setEnabled] = useState(false), [offset, setOffset] = useState(0), [src, setSrc] = useState('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setFile(null); setEnabled(false); setOffset(0); setError(''); setLoading(false);
    return () => { generation.current++; };
  }, [source]);
  useEffect(() => {
    if (!file) { setSrc(''); return; }
    const url = URL.createObjectURL(new Blob([subtitlesVtt(file.cues, offset)], { type: 'text/vtt' }));
    setSrc(url); return () => URL.revokeObjectURL(url);
  }, [file, offset]);
  const load = async (value?: File) => {
    if (!value) return;
    const request = ++generation.current;
    setError(''); setLoading(true);
    try {
      if (!/\.(srt|vtt)$/i.test(value.name)) throw new Error('Нужен файл SRT или VTT.');
      if (value.size > 5 * 1024 * 1024) throw new Error('Файл субтитров должен быть меньше 5 МБ.');
      const bytes = new Uint8Array(await value.arrayBuffer());
      let text: string;
      if (bytes[0] === 255 && bytes[1] === 254) text = new TextDecoder('utf-16le').decode(bytes);
      else if (bytes[0] === 254 && bytes[1] === 255) text = new TextDecoder('utf-16be').decode(bytes);
      else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = new TextDecoder('windows-1251').decode(bytes); } }
      const cues = parseSubtitles(text);
      if (generation.current === request) { setFile({ name: value.name, cues }); setOffset(0); setEnabled(true); }
    } catch (failure) { if (generation.current === request) setError(failure instanceof Error ? failure.message : 'Не удалось прочитать субтитры.'); }
    finally { if (generation.current === request) setLoading(false); }
  };
  const captions = useMemo(() => file && src ? { src, label: file.name, cues: file.cues, offset, enabled } : undefined, [file, src, offset, enabled]);
  return { file, enabled, setEnabled, offset, setOffset, error, loading, load, captions };
}

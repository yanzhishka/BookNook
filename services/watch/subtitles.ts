export interface SubtitleCue { start: number; end: number; text: string }
const timestamp = (value: string): number => {
  const match = value.match(/^(?:(\d{1,3}):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return NaN;
  return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
};

// Normalize timing and retain plain cue text only; neither file format needs
// executable markup, styles or remote resources to display subtitles.
export function parseSubtitles(source: string): SubtitleCue[] {
  if (source.length > 5 * 1024 * 1024) throw new Error('Файл субтитров должен быть меньше 5 МБ.');
  const cues: SubtitleCue[] = [];
  const blocks = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n[\t ]*\n/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/.test(lines[0] || '')) continue;
    const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0) continue;
    const match = lines[index].match(/^\s*(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
    if (!match) continue;
    const start = timestamp(match[1]), end = timestamp(match[2]);
    const text = lines.slice(index + 1).join('\n').replace(/<[^>]*>/g, '').replace(/\{\\[^}]*\}/g, '')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) cues.push({ start, end, text });
    if (cues.length > 20000) throw new Error('В файле слишком много субтитров.');
  }
  if (!cues.length) throw new Error('Не удалось прочитать субтитры. Нужен файл SRT или VTT.');
  return cues.sort((a, b) => a.start - b.start || a.end - b.end);
}

export function subtitleText(cues: SubtitleCue[], time: number, offset = 0): string {
  const position = time - offset;
  return cues.filter(cue => cue.start <= position && cue.end > position).map(cue => cue.text).join('\n');
}

export function subtitlesVtt(cues: SubtitleCue[], offset = 0): string {
  const stamp = (time: number) => {
    const ms = Math.round(Math.max(0, time) * 1000);
    return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `WEBVTT\n\n${cues.filter(cue => cue.end + offset > 0).map(cue => `${stamp(cue.start + offset)} --> ${stamp(cue.end + offset)}\n${escape(cue.text)}`).join('\n\n')}\n`;
}

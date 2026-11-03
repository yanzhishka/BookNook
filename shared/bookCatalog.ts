export const BOOK_LANGUAGES = [
  { code: 'ru', label: 'Русский', catalogCode: 'rus', starters: ['Евгений Онегин (Пушкин)', 'Преступление и наказание (Достоевский)', 'Капитанская дочка (Пушкин)', 'Мёртвые души (Гоголь)'], authors: ['Пушкин', 'Достоевский', 'Чехов'] },
  { code: 'en', label: 'English', catalogCode: 'eng', starters: ['Pride and Prejudice', "Alice's Adventures in Wonderland", 'The Adventures of Sherlock Holmes', 'Frankenstein, or the Modern Prometheus (First Edition, 1818)'], authors: ['Austen', 'Carroll', 'Shakespeare'] },
  { code: 'fr', label: 'Français', catalogCode: 'fre', starters: ['Le Tour du monde en quatre-vingts jours', 'Les Misérables', 'Le Comte de Monte-Cristo', 'Les Fleurs du mal'], authors: ['Hugo', 'Verne', 'Maupassant'] },
  { code: 'de', label: 'Deutsch', catalogCode: 'ger', starters: ['Die Verwandlung (Franz Kafka)', 'Faust - Der Tragödie erster Teil', 'Der Schimmelreiter', 'Kinder- und Hausmärchen'], authors: ['Goethe', 'Kafka', 'Grimm'] },
  { code: 'es', label: 'Español', catalogCode: 'spa', starters: ['Don Quijote de la Mancha', 'La vida es sueño', 'Rimas', 'Lazarillo de Tormes'], authors: ['Cervantes', 'Bécquer', 'Lope de Vega'] },
  { code: 'it', label: 'Italiano', catalogCode: 'ita', starters: ['Divina Commedia', 'I promessi sposi (1840)', 'Le avventure di Pinocchio', 'Il principe'], authors: ['Dante', 'Manzoni', 'Collodi'] },
  { code: 'pt', label: 'Português', catalogCode: 'por', starters: ['Os Lusíadas', 'Dom Casmurro', 'O Alienista', 'Memórias Póstumas de Brás Cubas'], authors: ['Machado de Assis', 'Camões', 'Pessoa'] },
  { code: 'uk', label: 'Українська', catalogCode: 'ukr', starters: ['Кобзарь (1840)', 'Лісова пісня', 'Енеїда (Котляревський)', 'Кайдашева сімя̀'], authors: ['Шевченко', 'Леся Українка', 'Франко'] },
  { code: 'pl', label: 'Polski', catalogCode: 'pol', starters: ['Pan Tadeusz', 'Lalka (Prus)', 'Quo vadis', 'W pustyni i w puszczy'], authors: ['Mickiewicz', 'Sienkiewicz', 'Prus'] },
] as const;

export type BookLanguage = typeof BOOK_LANGUAGES[number]['code'];
export interface CatalogBook {
  id: string;
  provider: 'wikisource' | 'openlibrary';
  sourcePage: string;
  sourceUrl: string;
  title: string;
  author: string;
  coverUrl: string;
  language: BookLanguage;
  description: string;
  hasReadableText: boolean;
  firstPublishYear?: number;
  editionLabel?: string;
}
export interface CatalogSearch {
  books: CatalogBook[];
  hasMore: boolean;
  warnings: string[];
}
export interface WebChapter { title: string; url: string; html: string }
export type CatalogText = { kind: 'editions'; books: CatalogBook[] } | {
  kind: 'text'; title: string; author: string; language: BookLanguage;
  sourceUrl: string; chapters: WebChapter[];
};
export const languageInfo = (code: string) => BOOK_LANGUAGES.find(language => language.code === code);
export const wikiUrl = (language: BookLanguage, title: string) =>
  `https://${language}.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

import { createPortal } from "react-dom";
import type { FormEvent, RefObject, ChangeEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { Book, CommunityKind } from "../../types";
import { useDialog } from "../../utils/useDialog";
import styles from "./CreateThreadModal.module.css";
interface Props {
  fileInputRef: RefObject<HTMLInputElement>;
  isCreating: boolean;
  uploading: boolean;
  newContent: string;
  newImage: string | null;
  newTitle: string;
  kind: CommunityKind;
  bookId: string;
  books: Book[];
  error: string;
  onClose: () => void;
  onContentChange: (v: string) => void;
  onImageClear: () => void;
  onImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onTitleChange: (v: string) => void;
  onKindChange: (v: CommunityKind) => void;
  onBookChange: (v: string) => void;
}
export const CreateThreadModal = (p: Props) => {
  const ref = useDialog(p.onClose, p.isCreating);
  return createPortal(
    <div className={styles.modalLayer}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Закрыть форму новой темы"
        disabled={p.isCreating}
        onClick={p.onClose}
      />
      <section
        ref={ref}
        tabIndex={-1}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-thread-title"
      >
        <header className={styles.header}>
          <h2 id="create-thread-title">Новая тема</h2>
          <button
            type="button"
            aria-label="Закрыть"
            disabled={p.isCreating}
            onClick={p.onClose}
          >
            <X size={24} />
          </button>
        </header>
        <form onSubmit={p.onSubmit} className={styles.form}>
          <fieldset className={styles.kind}>
            <legend>Что хотите обсудить</legend>
            {[
              { id: "discussion", label: "Обсуждение" },
              { id: "quote", label: "Цитата" },
              { id: "review", label: "Отзыв" },
            ].map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="topic-kind"
                  value={item.id}
                  checked={p.kind === item.id}
                  disabled={p.isCreating}
                  onChange={() => p.onKindChange(item.id as CommunityKind)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <label className={styles.field}>
            Название
            <input
              data-autofocus
              required
              maxLength={160}
              disabled={p.isCreating}
              value={p.newTitle}
              onChange={(e) => p.onTitleChange(e.target.value)}
              placeholder="Что стоит обсудить?"
            />
          </label>
          <label className={styles.field}>
            Текст
            <textarea
              required
              maxLength={20000}
              disabled={p.isCreating}
              value={p.newContent}
              onChange={(e) => p.onContentChange(e.target.value)}
              placeholder={
                p.kind === "quote"
                  ? "Цитата и ваш комментарий"
                  : p.kind === "review"
                    ? "Что понравилось и что вызвало вопросы?"
                    : "Поделитесь мыслью или задайте вопрос"
              }
            />
          </label>
          <label className={styles.field}>
            Книга <span className={styles.optional}>необязательно</span>
            <select
              disabled={p.isCreating}
              value={p.bookId}
              onChange={(e) => p.onBookChange(e.target.value)}
            >
              <option value="">Без привязки к книге</option>
              {p.books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} — {book.author}
                </option>
              ))}
            </select>
          </label>
          <p className={styles.hint}>
            Прикрепляется только карточка книги — её текст и ваши заметки
            остаются личными
          </p>
          <div className={styles.imageRow}>
            <input
              ref={p.fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={p.onImageUpload}
            />
            {p.newImage ? (
              <div className={styles.preview}>
                <img src={p.newImage} alt="Прикреплённое изображение" />
                <button
                  type="button"
                  aria-label="Удалить изображение"
                  disabled={p.isCreating}
                  onClick={p.onImageClear}
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={p.isCreating || p.uploading}
                onClick={() => p.fileInputRef.current?.click()}
                className={styles.attach}
              >
                <ImagePlus size={18} />
                {p.uploading ? "Читаем изображение…" : "Изображение"}
                <span>до 2 МБ</span>
              </button>
            )}
          </div>
          {p.error && (
            <p role="alert" className={styles.error}>
              {p.error}
            </p>
          )}
          <footer className={styles.footer}>
            <button type="button" disabled={p.isCreating} onClick={p.onClose}>
              Закрыть
            </button>
            <button
              type="submit"
              disabled={
                p.isCreating ||
                p.uploading ||
                !p.newTitle.trim() ||
                !p.newContent.trim()
              }
            >
              {p.isCreating && <Loader2 size={16} className={styles.spinner} />}
              Опубликовать
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
};

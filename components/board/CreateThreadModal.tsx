import React from 'react';
import { Camera, Loader2, Send, Trash2, X } from 'lucide-react';
import { classNames } from '../../utils/classNames';
import styles from './CreateThreadModal.module.css';

interface CreateThreadModalProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  isCreating: boolean;
  newContent: string;
  newImage: string | null;
  newTitle: string;
  onClose: () => void;
  onContentChange: (value: string) => void;
  onImageClear: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent) => void;
  onTitleChange: (value: string) => void;
}

export const CreateThreadModal: React.FC<CreateThreadModalProps> = ({
  fileInputRef,
  isCreating,
  newContent,
  newImage,
  newTitle,
  onClose,
  onContentChange,
  onImageClear,
  onImageUpload,
  onSubmit,
  onTitleChange,
}) => {
  return (
    <div className={styles.modalLayer}>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Закрыть форму создания треда"
        onClick={() => {
          if (!isCreating) onClose();
        }}
      />

      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="create-thread-title">
        <div className={styles.header}>
          <h3 id="create-thread-title" className={styles.title}>
            Новый тред
          </h3>
          <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Закрыть">
            <X size={36} />
          </button>
        </div>

        <form onSubmit={onSubmit} className={styles.form}>
          <div>
            <label className={styles.label} htmlFor="thread-title">
              Тема обсуждения
            </label>
            <input
              id="thread-title"
              required
              value={newTitle}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="О чем будем говорить?"
              className={styles.titleInput}
            />
          </div>

          <div>
            <label className={styles.label} htmlFor="thread-content">
              Контент
            </label>
            <textarea
              id="thread-content"
              required
              value={newContent}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Разверните вашу мысль..."
              className={styles.contentInput}
            />
          </div>

          <div className={styles.imageRow}>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              accept="image/*"
              onChange={onImageUpload}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={classNames(styles.uploadButton, newImage ? styles.uploadButtonFilled : styles.uploadButtonEmpty)}
            >
              {newImage ? (
                <img src={newImage} className={styles.uploadPreview} alt="" />
              ) : (
                <>
                  <span className={styles.uploadIcon}>
                    <Camera size={36} />
                  </span>
                  <span className={styles.uploadText}>Прикрепить обложку</span>
                </>
              )}
            </button>

            {newImage && (
              <button
                type="button"
                onClick={onImageClear}
                className={styles.clearImageButton}
                aria-label="Удалить обложку"
              >
                <Trash2 size={28} />
              </button>
            )}
          </div>

          <button type="submit" disabled={isCreating} className={styles.submitButton}>
            {isCreating ? <Loader2 size={24} className={styles.spinner} /> : <Send size={20} />}
            <span>Запустить тред</span>
          </button>
        </form>
      </section>
    </div>
  );
};

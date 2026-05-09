import React from 'react';
import { Camera, Loader2, Send, X } from 'lucide-react';
import styles from './ReplyComposer.module.css';

interface ReplyComposerProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  image: string | null;
  isReplying: boolean;
  value: string;
  onClearImage: () => void;
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
}

export const ReplyComposer: React.FC<ReplyComposerProps> = ({
  fileInputRef,
  image,
  isReplying,
  value,
  onClearImage,
  onImageUpload,
  onSubmit,
  onValueChange,
}) => {
  return (
    <div className={styles.composer}>
      <div className={styles.editor}>
        <textarea
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Напишите ответ..."
          className={styles.textarea}
        />

        {image && (
          <div className={styles.preview}>
            <img src={image} className={styles.previewImage} alt="" />
            <button
              type="button"
              onClick={onClearImage}
              className={styles.clearPreviewButton}
              aria-label="Удалить изображение"
            >
              <X size={24} />
            </button>
          </div>
        )}

        <div className={styles.actions}>
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
            className={styles.attachButton}
            aria-label="Прикрепить изображение"
          >
            <Camera size={20} />
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!value.trim() || isReplying}
            className={styles.submitButton}
          >
            {isReplying ? <Loader2 size={16} className={styles.spinner} /> : <Send size={16} />}
            <span>Отправить</span>
          </button>
        </div>
      </div>
    </div>
  );
};

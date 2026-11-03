import type { ChangeEvent, RefObject } from "react";
import { Camera, Loader2, Send, X } from "lucide-react";
import styles from "./ReplyComposer.module.css";
interface Props {
  fileInputRef: RefObject<HTMLInputElement>;
  image: string | null;
  isReplying: boolean;
  uploading: boolean;
  loading: boolean;
  value: string;
  allowImages: boolean;
  isGuest: boolean;
  onRequireLogin?: () => void;
  onClearImage: () => void;
  onImageUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onValueChange: (v: string) => void;
}
export const ReplyComposer = (p: Props) =>
  p.isGuest ? (
    <div className={styles.guest}>
      <p>Войдите, чтобы ответить</p>
      <button onClick={p.onRequireLogin}>Войти</button>
    </div>
  ) : (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        p.onSubmit();
      }}
    >
      <label className="sr-only" htmlFor="grid-reply">
        Ваш ответ
      </label>
      <textarea
        id="grid-reply"
        value={p.value}
        disabled={p.isReplying}
        maxLength={p.allowImages ? 20000 : 2000}
        onChange={(e) => p.onValueChange(e.target.value)}
        placeholder="Ваш ответ"
      />
      {p.image && (
        <div className={styles.preview}>
          <img src={p.image} alt="Прикреплённое изображение" />
          <button
            type="button"
            onClick={p.onClearImage}
            disabled={p.isReplying}
            aria-label="Удалить изображение"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div className={styles.actions}>
        {p.allowImages && (
          <>
            <input
              ref={p.fileInputRef}
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={p.onImageUpload}
            />
            <button
              type="button"
              disabled={p.isReplying || p.uploading}
              onClick={() => p.fileInputRef.current?.click()}
              aria-label="Прикрепить изображение"
              className={styles.attach}
            >
              <Camera size={18} />
            </button>
          </>
        )}
        <button
          className={styles.submit}
          type="submit"
          disabled={!p.value.trim() || p.isReplying || p.loading || p.uploading}
        >
          {p.isReplying || p.uploading ? (
            <Loader2 size={16} className={styles.spinner} />
          ) : (
            <Send size={16} />
          )}
          Ответить
        </button>
      </div>
    </form>
  );

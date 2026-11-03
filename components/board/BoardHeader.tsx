import type { FormEvent } from "react";
import { Plus, RefreshCw, Search } from "lucide-react";
import type { CommunityKind } from "../../types";
import {
  TOPIC_KINDS,
  type TopicScope,
  type TopicSort,
} from "../../services/community";
import styles from "./BoardHeader.module.css";

interface Props {
  query: string;
  kind: CommunityKind | "all";
  scope: TopicScope;
  sort: TopicSort;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onKindChange: (value: CommunityKind | "all") => void;
  onScopeChange: (value: TopicScope) => void;
  onSortChange: (value: TopicSort) => void;
  onCreateThread: () => void;
  onRefresh: () => void;
}
export const BoardHeader = ({
  query,
  kind,
  scope,
  sort,
  loading,
  onQueryChange,
  onSearch,
  onKindChange,
  onScopeChange,
  onSortChange,
  onCreateThread,
  onRefresh,
}: Props) => {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch();
  };
  return (
    <header className={styles.header}>
      <h1 className="sr-only">The Grid</h1>
      <div className={styles.topRow}>
        <form className={styles.search} onSubmit={submit}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Поиск в The Grid"
            placeholder="Тема, книга или автор"
            maxLength={200}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <button type="submit">Найти</button>
        </form>
        <button
          type="button"
          onClick={onCreateThread}
          className={styles.createButton}
        >
          <Plus size={18} />
          <span>Новая тема</span>
        </button>
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.kinds} role="group" aria-label="Тип темы">
          {[{ value: "all", label: "Все" }, ...TOPIC_KINDS].map((item) => (
            <button
              key={item.value}
              aria-pressed={kind === item.value}
              onClick={() => onKindChange(item.value as CommunityKind | "all")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.options}>
          <label>
            <span className="sr-only">Показать темы</span>
            <select
              aria-label="Показать темы"
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as TopicScope)}
            >
              <option value="all">Все темы</option>
              <option value="mine">Мои темы</option>
              <option value="unanswered">Без ответов</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Сортировка тем</span>
            <select
              aria-label="Сортировка тем"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as TopicSort)}
            >
              <option value="new">Новые</option>
              <option value="active">Активные</option>
              <option value="popular">Обсуждаемые</option>
            </select>
          </label>
          <button
            type="button"
            aria-label="Обновить темы"
            title="Обновить"
            disabled={loading}
            onClick={onRefresh}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

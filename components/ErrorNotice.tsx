interface ErrorNoticeProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorNotice = ({ message, onRetry }: ErrorNoticeProps) => (
  <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
    <p>{message}</p>
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-current px-4 py-2 font-bold">
        Попробовать снова
      </button>
    )}
  </div>
);

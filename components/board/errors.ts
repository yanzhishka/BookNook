export const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && /^[А-Яа-яЁё]/.test(error.message) ? error.message : fallback;

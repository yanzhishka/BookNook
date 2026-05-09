export type DeleteTarget =
  | { type: 'thread'; id: string }
  | { type: 'reply'; id: string; parentId: string };

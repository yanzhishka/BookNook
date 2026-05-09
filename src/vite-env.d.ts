// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEY: string
  readonly VITE_LOCAL_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

interface Window {
  aistudio?: {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
    apiKey?: string;
  };
}

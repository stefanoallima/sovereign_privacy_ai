/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRAND?: "sovereign" | "normattiva";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

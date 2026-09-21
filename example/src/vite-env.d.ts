/// <reference types="vite/client" />

declare module '*.frag?raw' {
  const src: string;
  export default src;
}

declare module '*?worker&url' {
  const url: string;
  export default url;
}

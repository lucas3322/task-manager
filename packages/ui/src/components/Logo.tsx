import { useId } from "react";

/** Marca do Orbitask: três estrelas sobre o gradiente da identidade. */
export function LogoMark({ size = 28 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="92 92 840 840" aria-hidden="true" className="ui-logo-mark">
      <defs>
        <linearGradient id={id} x1="170" y1="120" x2="850" y2="930" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7568F8" />
          <stop offset="1" stopColor="#A65AE8" />
        </linearGradient>
      </defs>
      <rect x="92" y="92" width="840" height="840" rx="224" fill={`url(#${id})`} />
      <path d="M512 268c18 112 64 158 176 176-112 18-158 64-176 176-18-112-64-158-176-176 112-18 158-64 176-176Z" fill="#fff" />
      <path d="M720 270c9 58 33 82 91 91-58 9-82 33-91 91-9-58-33-82-91-91 58-9 82-33 91-91Z" fill="#fff" opacity=".96" />
      <path d="M310 570c8 50 29 71 79 79-50 8-71 29-79 79-8-50-29-71-79-79 50-8 71-29 79-79Z" fill="#fff" opacity=".92" />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="ui-wordmark">
      <LogoMark size={size} />
      <span>Orbitask</span>
    </span>
  );
}

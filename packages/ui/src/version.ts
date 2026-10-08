export const APP_VERSION = "0.5.0";

const PUBLIC_SITE = "https://handsome-upliftment-production-4492.up.railway.app";

/** Endereço do site público: a própria origem no navegador, o site oficial no Desktop. */
export const siteUrl = () => (/^https?:/.test(window.location.protocol) && !/localhost:5173/.test(window.location.host) ? window.location.origin : PUBLIC_SITE);

import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import type { OrbitaskApi } from "@orbitask/contracts";
import { setApi, type Platform } from "./api";
import { OrbitaskApp } from "./App";
import { useStore } from "./store";
import "./styles/index.css";

export { OrbitaskApp } from "./App";
export { createHttpApi } from "./http-api";
export { setApi, api, errorMessage } from "./api";
export { LogoMark, Wordmark } from "./components/Logo";
export { APP_VERSION } from "./version";

/** Monta o aplicativo completo (web ou desktop) no elemento indicado. */
export function mountOrbitask(element: HTMLElement, options: { api: OrbitaskApi; platform: Platform; os?: string }) {
  setApi(options.api);
  useStore.getState().configure(options.platform, options.os ?? "");
  createRoot(element).render(
    <StrictMode>
      <OrbitaskApp />
    </StrictMode>,
  );
}

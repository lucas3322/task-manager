import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@orbitask/ui/tokens.css";
import "./site.css";
import { DownloadPage, LandingPage, ReleasesPage } from "./pages";

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:3300/api/v1").replace(/\/$/, "");
const root = document.getElementById("root")!;
const path = window.location.pathname;

if (path.startsWith("/app")) {
  /* O app completo é carregado sob demanda: a landing continua leve. */
  void import("@orbitask/ui").then(({ mountOrbitask, createHttpApi }) => {
    mountOrbitask(root, { api: createHttpApi(apiUrl), platform: "web" });
  });
} else {
  const Page = path.startsWith("/download") ? DownloadPage : path.startsWith("/novidades") ? ReleasesPage : LandingPage;
  createRoot(root).render(
    <StrictMode>
      <Page />
    </StrictMode>,
  );
}

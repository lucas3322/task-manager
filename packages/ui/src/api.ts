import type { OrbitaskApi } from "@orbitask/contracts";

export type Platform = "web" | "desktop";

let current: OrbitaskApi | null = null;

export function setApi(api: OrbitaskApi) {
  current = api;
}

/** Implementação ativa: IPC no desktop, HTTP no navegador. */
export function api(): OrbitaskApi {
  if (!current) throw new Error("API do Orbitask não inicializada");
  return current;
}

/** Remove o prefixo técnico que o Electron adiciona às mensagens vindas do processo principal. */
export function errorMessage(error: unknown, fallback = "Algo deu errado. Tente novamente.") {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "").trim();
  if (/failed to fetch|networkerror|load failed/i.test(message)) return "Sem conexão com o servidor. Verifique sua internet.";
  return message || fallback;
}

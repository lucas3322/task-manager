import { useEffect, useRef, useState } from "react";
import { LogoMark } from "./components/Logo";
import { ConfirmHost, PromptHost, Spinner, Toaster, hasOpenLayer, isTyping } from "./components/primitives";
import { ProjectScreen, projectViewTabs } from "./project/ProjectScreen";
import { ProjectSettingsScreen } from "./project/ProjectSettings";
import { AuthScreen } from "./screens/Auth";
import { HomeScreen } from "./screens/Home";
import { InboxScreen } from "./screens/Inbox";
import { MyTasksScreen } from "./screens/MyTasks";
import { PeopleScreen } from "./screens/People";
import { ReportsScreen } from "./screens/Reports";
import { SettingsScreen } from "./screens/Settings";
import { StrategyScreen } from "./screens/Strategy";
import { CommandPalette, CreateProjectDialog, CreateTaskDialog } from "./shell/Overlays";
import { Sidebar } from "./shell/Sidebar";
import { TaskSheet } from "./task/TaskSheet";
import { hashToRoute, routeToHash, useStore, type Theme } from "./store";

declare global {
  interface Window {
    orbitaskDesktop?: {
      platform: string;
      setTheme(source: Theme): Promise<void>;
      updates?: {
        check(): Promise<{ current: string; latest: string; available: boolean; releaseUrl: string }>;
        download(): Promise<void>;
        onProgress(listener: (percent: number) => void): () => void;
      };
    };
  }
}

/** Aplica tema e cor de destaque no documento (e no material nativo do Desktop). */
function useAppearance() {
  const theme = useStore((state) => state.prefs.theme);
  const accent = useStore((state) => state.prefs.accent);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    if (accent === "violet") root.removeAttribute("data-accent");
    else root.setAttribute("data-accent", accent);
    void window.orbitaskDesktop?.setTheme(theme).catch(() => undefined);
    const timer = setTimeout(() => root.classList.remove("theme-transition"), 400);
    return () => clearTimeout(timer);
  }, [theme, accent]);
}

/** Mantém a rota em sincronia com o endereço: voltar/avançar e links funcionam. */
function useHashRouting() {
  const route = useStore((state) => state.route);
  const session = useStore((state) => state.session);
  const navigate = useStore((state) => state.navigate);
  useEffect(() => {
    if (!session) return;
    const hash = routeToHash(route);
    if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
  }, [route, session]);
  useEffect(() => {
    const onPop = () => {
      const next = hashToRoute(window.location.hash);
      if (next && routeToHash(next) !== routeToHash(useStore.getState().route)) navigate(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate]);
}

function useShortcuts() {
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const state = useStore.getState();
      if (!state.session || !state.snapshot) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        state.setPaletteOpen(!state.paletteOpen);
        return;
      }
      if (mod && event.key === ",") {
        event.preventDefault();
        state.navigate({ name: "settings", tab: "profile" });
        return;
      }
      if (mod || event.altKey || isTyping(event) || hasOpenLayer() || state.selectedTaskId) return;
      const key = event.key.toLowerCase();
      if (pending.current === "g") {
        pending.current = null;
        const target = { i: "home", t: "my-tasks", e: "inbox", r: "reports", m: "strategy", p: "people" }[key];
        if (target) {
          event.preventDefault();
          state.navigate({ name: target } as never);
        }
        return;
      }
      if (key === "g") {
        pending.current = "g";
        setTimeout(() => (pending.current = null), 900);
        return;
      }
      if (key === "c") {
        event.preventDefault();
        state.openCreateTask();
      } else if (event.key === "?") {
        event.preventDefault();
        state.navigate({ name: "settings", tab: "shortcuts" });
      } else if (state.route.name === "project" && /^[1-5]$/.test(key)) {
        event.preventDefault();
        state.navigate({ name: "project", projectId: state.route.projectId, view: projectViewTabs[Number(key) - 1].id });
      } else if (key === "/" && state.route.name === "project") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("orbitask:focus-filter"));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Mantém os dados em dia sem recarregar a página: ao voltar para a janela
 * e a cada 20 s enquanto ela está visível (o que outras pessoas mudaram aparece sozinho).
 */
function useLiveSync() {
  const signedIn = useStore((state) => Boolean(state.session && state.snapshot));
  useEffect(() => {
    if (!signedIn) return;
    let last = Date.now();
    const sync = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 4000) return;
      last = Date.now();
      const state = useStore.getState();
      void state.refresh({ silent: true });
      void state.loadUnread();
    };
    const timer = window.setInterval(sync, 20000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [signedIn]);
}

function Screen() {
  const route = useStore((state) => state.route);
  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "my-tasks":
      return <MyTasksScreen />;
    case "inbox":
      return <InboxScreen />;
    case "reports":
      return <ReportsScreen />;
    case "strategy":
      return <StrategyScreen />;
    case "people":
      return <PeopleScreen />;
    case "settings":
      return <SettingsScreen tab={route.tab} />;
    case "project":
      return <ProjectScreen projectId={route.projectId} view={route.view} />;
    case "project-settings":
      return <ProjectSettingsScreen projectId={route.projectId} tab={route.tab} />;
  }
}

export function OrbitaskApp() {
  const ready = useStore((state) => state.ready);
  const session = useStore((state) => state.session);
  const snapshot = useStore((state) => state.snapshot);
  const boot = useStore((state) => state.boot);
  const platform = useStore((state) => state.platform);
  const os = useStore((state) => state.os);
  const collapsed = useStore((state) => state.prefs.sidebarCollapsed);
  const navOpen = useStore((state) => state.navOpen);
  const setNavOpen = useStore((state) => state.setNavOpen);
  const route = useStore((state) => state.route);
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get("convite"));
  const signup = new URLSearchParams(window.location.search).has("cadastro");
  useAppearance();
  useHashRouting();
  useShortcuts();
  useLiveSync();

  useEffect(() => {
    void boot(hashToRoute(window.location.hash));
  }, [boot]);

  useEffect(() => {
    document.title = route.name === "project" && snapshot ? `${snapshot.project.name} · Orbitask` : "Orbitask";
  }, [route, snapshot]);

  const clearInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("convite");
    window.history.replaceState(null, "", url.toString());
    setInvite(null);
  };

  const classes = `orbitask platform-${platform} os-${os || "web"}`;
  if (!ready)
    return (
      <div className={`${classes} app-splash`}>
        <LogoMark size={52} />
        <Spinner />
        <Toaster />
      </div>
    );

  if (!session || !snapshot)
    return (
      <div className={classes}>
        <AuthScreen inviteToken={invite} initialMode={signup ? "signup" : "login"} onInviteHandled={clearInvite} />
        <Toaster />
      </div>
    );

  return (
    <div className={`${classes} app-shell ${collapsed ? "sidebar-collapsed" : ""} ${navOpen ? "nav-open" : ""}`}>
      <Sidebar />
      <button type="button" className="nav-scrim" aria-label="Fechar navegação" tabIndex={navOpen ? 0 : -1} onClick={() => setNavOpen(false)} />
      <main className="app-main">
        <Screen />
      </main>
      <TaskSheet />
      <CreateTaskDialog />
      <CreateProjectDialog />
      <CommandPalette />
      <ConfirmHost />
      <PromptHost />
      <Toaster />
    </div>
  );
}

import { mountOrbitask } from "@orbitask/ui";

/* O Desktop usa a mesma interface da web; os dados chegam pelo IPC seguro do processo principal. */
mountOrbitask(document.getElementById("root")!, {
  api: window.orbitask,
  platform: "desktop",
  os: window.orbitaskDesktop?.platform ?? "",
});

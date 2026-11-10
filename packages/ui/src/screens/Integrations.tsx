import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import type { ApiToken, CreatedApiToken } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { Segmented, Spinner, confirm } from "../components/primitives";
import { formatDate, relativeTime } from "../lib/format";
import { useStore } from "../store";
import { siteUrl } from "../version";
import { SettingsGroup, SettingsRow } from "./Settings";

type Client = "claude" | "codex" | "json";
type System = "unix" | "windows";
const detectSystem = (): System => (/windows|win32|win64/i.test(`${navigator.userAgent} ${navigator.platform}`) ? "windows" : "unix");
const TOKEN_PLACEHOLDER = "COLE_SEU_TOKEN_AQUI";

function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="code-block">
      <pre aria-label={label}>
        <code>{code}</code>
      </pre>
      <button type="button" className="ui-icon-button small" onClick={() => void copy()} aria-label={`Copiar ${label}`} title="Copiar">
        {copied ? <Check /> : <Copy />}
      </button>
    </div>
  );
}

const expiryOptions = [
  { value: "", label: "Sem validade" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
];

export function IntegrationsSettings() {
  const toast = useStore((state) => state.toast);
  const fail = useStore((state) => state.fail);
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [apiUrl, setApiUrl] = useState("");
  const [form, setForm] = useState({ name: "", expires: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [client, setClient] = useState<Client>("claude");
  const [system, setSystem] = useState<System>(detectSystem);

  useEffect(() => {
    api()
      .listApiTokens()
      .then(setTokens)
      .catch((reason) => {
        setTokens([]);
        setError(errorMessage(reason));
      });
    void api().getApiUrl?.().then(setApiUrl).catch(() => undefined);
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const token = await api().createApiToken({ name: form.name.trim(), expiresInDays: form.expires ? Number(form.expires) : null });
      setCreated(token);
      setTokens((current) => [token, ...(current ?? [])]);
      setForm({ name: "", expires: "" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (item: ApiToken) => {
    if (!(await confirm({ title: `Revogar "${item.name}"?`, message: "Integrações que usam este token param de funcionar na hora. Isso não pode ser desfeito.", confirmLabel: "Revogar", destructive: true }))) return;
    try {
      await api().revokeApiToken(item.id);
      setTokens((current) => (current ?? []).filter((token) => token.id !== item.id));
      if (created?.id === item.id) setCreated(null);
      toast("Token revogado", { tone: "success" });
    } catch (reason) {
      fail(reason);
    }
  };

  const token = created?.token ?? TOKEN_PLACEHOLDER;
  const url = apiUrl || "https://SEU-SERVIDOR/api/v1";
  const win = system === "windows";
  const serverUrl = `${siteUrl()}/mcp/orbitask-mcp.mjs`;
  /* Caminho para configs que não expandem ~ ou $HOME: o usuário troca "voce" pelo próprio nome de usuário. */
  const absolutePath = win ? "C:\\Users\\voce\\.orbitask\\orbitask-mcp.mjs" : "/Users/voce/.orbitask/orbitask-mcp.mjs";
  const download = win
    ? `New-Item -ItemType Directory -Force "$HOME\\.orbitask" | Out-Null\nInvoke-WebRequest -Uri "${serverUrl}" -OutFile "$HOME\\.orbitask\\orbitask-mcp.mjs"`
    : `mkdir -p ~/.orbitask && curl -fsSL ${serverUrl} -o ~/.orbitask/orbitask-mcp.mjs`;
  const snippets: Record<Client, { label: string; hint: string; code: string }> = {
    claude: {
      label: "comando do Claude Code",
      hint: win
        ? "Rode no PowerShell. O escopo user deixa o Orbitask disponível em qualquer pasta."
        : "Rode no terminal. O escopo user deixa o Orbitask disponível em qualquer pasta.",
      code: win
        ? `claude mcp add orbitask --scope user \`\n  --env ORBITASK_API_URL=${url} \`\n  --env ORBITASK_TOKEN=${token} \`\n  -- node "$HOME\\.orbitask\\orbitask-mcp.mjs"`
        : `claude mcp add orbitask --scope user \\\n  --env ORBITASK_API_URL=${url} \\\n  --env ORBITASK_TOKEN=${token} \\\n  -- node ~/.orbitask/orbitask-mcp.mjs`,
    },
    codex: {
      label: "configuração do Codex",
      hint: win
        ? "Adicione em %USERPROFILE%\\.codex\\config.toml. Troque \"voce\" pelo seu usuário do Windows (o Codex não expande variáveis no caminho)."
        : "Adicione em ~/.codex/config.toml. Troque /Users/voce pelo caminho da sua pasta pessoal (no Linux, /home/voce); o Codex não expande ~.",
      /* No Windows usamos string literal TOML ('…') para as barras invertidas não virarem escapes. */
      code: `[mcp_servers.orbitask]\ncommand = "node"\nargs = [${win ? `'${absolutePath}'` : `"${absolutePath}"`}]\nenv = { ORBITASK_API_URL = "${url}", ORBITASK_TOKEN = "${token}" }`,
    },
    json: {
      label: "configuração JSON",
      hint: `Formato usado por Claude Desktop, Cursor, Windsurf e outros clientes MCP. Troque "voce" pelo seu usuário${win ? " do Windows" : ""}.`,
      code: JSON.stringify(
        { mcpServers: { orbitask: { command: "node", args: [absolutePath], env: { ORBITASK_API_URL: url, ORBITASK_TOKEN: token } } } },
        null,
        2,
      ),
    },
  };
  const snippet = snippets[client];

  return (
    <>
      <SettingsGroup
        title="Servidor MCP"
        description="Conecte o Orbitask ao Claude Code, Codex ou qualquer cliente MCP: a IA passa a listar, criar e atualizar tarefas, comentar e desenhar o fluxograma dos seus projetos, com as mesmas permissões que você tem."
      >
        <div className="mcp-steps">
          <div className="mcp-step">
            <span className="mcp-step-index">1</span>
            <div>
              <strong>Gere um token de acesso</strong>
              <p>Cada máquina ou ferramenta deve ter o próprio token, para você poder revogar um sem afetar os outros.</p>
              <form className="token-form" onSubmit={create}>
                <label className="ui-field">
                  <span>Nome</span>
                  <input value={form.name} maxLength={80} placeholder="Ex.: Claude Code no notebook" onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label className="ui-field">
                  <span>Validade</span>
                  <select value={form.expires} onChange={(event) => setForm({ ...form, expires: event.target.value })}>
                    {expiryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="ui-button primary" disabled={busy || !form.name.trim()}>
                  {busy ? <Spinner size={14} /> : <KeyRound />} Gerar token
                </button>
              </form>
              {error && <div className="ui-alert error">{error}</div>}
              {created && (
                <div className="token-reveal" role="status">
                  <strong>Token "{created.name}" criado. Copie agora: ele não será exibido de novo.</strong>
                  <CodeBlock code={created.token} label="token" />
                </div>
              )}
            </div>
          </div>
          <div className="mcp-step">
            <span className="mcp-step-index">2</span>
            <div>
              <strong>Baixe o servidor</strong>
              <Segmented
                label="Sistema operacional"
                size="sm"
                value={system}
                onChange={setSystem}
                options={[
                  { value: "unix", label: "macOS / Linux" },
                  { value: "windows", label: "Windows" },
                ]}
              />
              <p>
                {win
                  ? "Abra o PowerShell e rode o comando abaixo. O arquivo único precisa do Node.js 18 ou mais novo (instale com winget install OpenJS.NodeJS.LTS, se ainda não tiver)."
                  : "Rode no terminal. O arquivo único precisa do Node.js 18 ou mais novo."}
              </p>
              <CodeBlock code={download} label="comando de download" />
            </div>
          </div>
          <div className="mcp-step">
            <span className="mcp-step-index">3</span>
            <div>
              <strong>Registre no seu cliente</strong>
              <Segmented
                label="Cliente MCP"
                size="sm"
                value={client}
                onChange={setClient}
                options={[
                  { value: "claude", label: "Claude Code" },
                  { value: "codex", label: "Codex" },
                  { value: "json", label: "Outros (JSON)" },
                ]}
              />
              <p>{snippet.hint}</p>
              <CodeBlock code={snippet.code} label={snippet.label} />
              {!created && <p className="subtle small-text">Gere um token acima para ele já aparecer preenchido aqui.</p>}
              <p className="subtle small-text">Quer que a IA só consulte, sem alterar nada? Adicione ORBITASK_READ_ONLY=1 às variáveis.</p>
            </div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Tokens ativos" description="Tokens dão acesso à sua conta neste workspace. Revogue os que você não usa mais.">
        {tokens === null ? (
          <div className="page-loading">
            <Spinner />
          </div>
        ) : tokens.length === 0 ? (
          <SettingsRow label="Nenhum token ainda" description="Gere um token acima para conectar uma integração." />
        ) : (
          tokens.map((item) => (
            <SettingsRow
              key={item.id}
              label={
                <>
                  {item.name} <code className="token-prefix">{item.prefix}…</code>
                </>
              }
              description={[
                `Criado em ${formatDate(item.createdAt)}`,
                item.lastUsedAt ? `usado ${relativeTime(item.lastUsedAt)}` : "nunca usado",
                item.expiresAt ? `expira em ${formatDate(item.expiresAt)}` : "sem validade",
              ].join(" · ")}
            >
              <button type="button" className="ui-button danger-ghost" onClick={() => void revoke(item)}>
                <Trash2 /> Revogar
              </button>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
    </>
  );
}

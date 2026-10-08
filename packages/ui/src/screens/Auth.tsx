import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, KanbanSquare, ShieldCheck, Users } from "lucide-react";
import type { InviteDetails } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { LogoMark } from "../components/Logo";
import { Segmented, Spinner } from "../components/primitives";
import { roleLabel } from "../lib/format";
import { useStore } from "../store";

function PasswordInput({
  value,
  onChange,
  autoComplete,
  placeholder = "Mínimo de 8 caracteres",
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="ui-input-affix">
      <input
        required
        minLength={8}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}

export function AuthScreen({ inviteToken, initialMode = "login", onInviteHandled }: { inviteToken?: string | null; initialMode?: "login" | "signup"; onInviteHandled?: () => void }) {
  const authenticate = useStore((state) => state.authenticate);
  const acceptInvite = useStore((state) => state.acceptInvite);
  const platform = useStore((state) => state.platform);
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [form, setForm] = useState({ name: "", workspaceName: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [inviteState, setInviteState] = useState<"idle" | "loading" | "invalid">(inviteToken ? "loading" : "idle");

  useEffect(() => {
    if (!inviteToken) return;
    const inspect = api().inspectInvite;
    if (!inspect) return setInviteState("invalid");
    inspect(inviteToken)
      .then((details) => {
        setInvite(details);
        setInviteState("idle");
      })
      .catch((reason) => {
        setError(errorMessage(reason, "Este convite não é mais válido"));
        setInviteState("invalid");
      });
  }, [inviteToken]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (inviteToken && invite) {
        await acceptInvite(inviteToken, { name: form.name, password: form.password });
        onInviteHandled?.();
      } else await authenticate(mode, form);
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível entrar"));
    } finally {
      setBusy(false);
    }
  };
  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const inviteMode = Boolean(inviteToken);
  return (
    <div className={`auth-screen platform-${platform}`}>
      <div className="auth-drag" />
      <section className="auth-story" aria-hidden="true">
        <div className="auth-story-inner">
          <LogoMark size={44} />
          <h1>
            Trabalho claro.
            <br />
            Equipe no ritmo.
          </h1>
          <p>Projetos, tarefas e decisões em um só lugar — simples para começar, sólido para crescer.</p>
          <ul>
            <li>
              <span>
                <KanbanSquare />
              </span>
              <div>
                <strong>Do quadro ao cronograma</strong>
                <small>Quadro, lista, calendário e cronograma sobre os mesmos dados.</small>
              </div>
            </li>
            <li>
              <span>
                <Users />
              </span>
              <div>
                <strong>Colaboração de verdade</strong>
                <small>Responsáveis, comentários, menções e caixa de entrada.</small>
              </div>
            </li>
            <li>
              <span>
                <ShieldCheck />
              </span>
              <div>
                <strong>Seguro por padrão</strong>
                <small>Senhas com bcrypt e sessões que você pode encerrar.</small>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <main className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate={false}>
          <LogoMark size={40} />
          {inviteMode ? (
            <>
              <h2>{invite ? `Entrar em ${invite.workspaceName}` : inviteState === "loading" ? "Abrindo convite…" : "Convite indisponível"}</h2>
              {invite && (
                <p className="auth-subtitle">
                  {invite.invitedByName} convidou <strong>{invite.email}</strong> como {roleLabel[invite.role].toLowerCase()}.
                </p>
              )}
            </>
          ) : (
            <>
              <h2>{mode === "login" ? "Entrar no Orbitask" : "Crie sua conta"}</h2>
              <p className="auth-subtitle">
                {mode === "login" ? "Continue de onde sua equipe parou." : "Seu workspace e primeiro projeto ficam prontos na hora."}
              </p>
              <Segmented
                label="Modo de acesso"
                value={mode}
                onChange={(value) => {
                  setMode(value);
                  setError("");
                }}
                options={[
                  { value: "login", label: "Entrar" },
                  { value: "signup", label: "Criar conta" },
                ]}
              />
            </>
          )}

          {inviteState === "loading" ? (
            <div className="auth-loading">
              <Spinner />
            </div>
          ) : inviteMode && !invite ? null : (
            <div className="auth-fields">
              {(mode === "signup" || inviteMode) && (
                <label className="ui-field">
                  <span>Seu nome</span>
                  <input required autoComplete="name" value={form.name} onChange={(event) => update("name")(event.target.value)} placeholder="Como devemos chamar você?" />
                </label>
              )}
              {mode === "signup" && !inviteMode && (
                <label className="ui-field">
                  <span>
                    Nome do workspace <em>opcional</em>
                  </span>
                  <input
                    autoComplete="organization"
                    value={form.workspaceName}
                    onChange={(event) => update("workspaceName")(event.target.value)}
                    placeholder="Empresa ou equipe"
                  />
                </label>
              )}
              {!inviteMode && (
                <label className="ui-field">
                  <span>E-mail</span>
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(event) => update("email")(event.target.value)}
                    placeholder="voce@empresa.com"
                  />
                </label>
              )}
              <label className="ui-field">
                <span>Senha</span>
                <PasswordInput
                  value={form.password}
                  onChange={update("password")}
                  autoComplete={mode === "login" && !inviteMode ? "current-password" : "new-password"}
                />
              </label>
            </div>
          )}

          {error && (
            <div className="ui-alert error" role="alert">
              {error}
            </div>
          )}
          {!(inviteMode && !invite) && inviteState !== "loading" && (
            <button className="ui-button primary large block" disabled={busy}>
              {busy ? <Spinner size={16} /> : null}
              {busy ? "Aguarde…" : inviteMode ? "Aceitar convite" : mode === "login" ? "Entrar" : "Criar conta"}
              {!busy && <ArrowRight />}
            </button>
          )}
          {inviteMode && !invite && inviteState === "invalid" && (
            <button type="button" className="ui-button block" onClick={onInviteHandled}>
              Ir para o login
            </button>
          )}
          {inviteMode && invite && <p className="auth-legal">Já tem conta no Orbitask? Use seu nome e a senha atual.</p>}
        </form>
      </main>
    </div>
  );
}

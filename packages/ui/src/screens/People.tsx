import { FormEvent, useEffect, useState } from "react";
import { Copy, Link2, Mail, MoreHorizontal, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import type { WorkspaceInvite, WorkspaceMember, WorkspaceRole } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { Avatar, Badge, Dialog, EmptyState, MenuItem, MenuLabel, MenuSeparator, Popover, ProjectGlyph, Spinner, confirm } from "../components/primitives";
import { formatDate, plural, roleLabel } from "../lib/format";
import { PageHeader } from "../shell/Sidebar";
import { useStore } from "../store";

const roleHelp: Record<WorkspaceRole, string> = {
  admin: "Gerencia pessoas, projetos e configurações",
  member: "Vê e edita todos os projetos",
  guest: "Acessa apenas os projetos escolhidos",
};

export function PeopleScreen() {
  const snapshot = useStore((state) => state.snapshot)!;
  const patchSnapshot = useStore((state) => state.patchSnapshot);
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const [members, setMembers] = useState<WorkspaceMember[]>(snapshot.members);
  const [invites, setInvites] = useState<WorkspaceInvite[]>(snapshot.invites);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [access, setAccess] = useState<WorkspaceMember | null>(null);
  const [query, setQuery] = useState("");
  const admin = snapshot.workspace.role === "admin";

  const load = async () => {
    try {
      const result = await api().listMembers();
      setMembers(result.members);
      setInvites(result.invites);
      patchSnapshot((current) => ({ ...current, members: result.members, invites: result.invites }));
    } catch (error) {
      fail(error, "Não foi possível carregar as pessoas");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
    const onInvite = () => setInviteOpen(true);
    window.addEventListener("orbitask:invite", onInvite);
    return () => window.removeEventListener("orbitask:invite", onInvite);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeRole = async (member: WorkspaceMember, role: WorkspaceRole) => {
    if (role === member.role) return;
    try {
      await api().updateMember({ userId: member.userId, role, projectIds: role === "guest" ? member.projectIds : [] });
      toast(`${member.name} agora é ${roleLabel[role].toLowerCase()}`);
      await load();
    } catch (error) {
      fail(error);
    }
  };
  const remove = async (member: WorkspaceMember) => {
    if (!(await confirm({ title: `Remover ${member.name}?`, message: "A pessoa perde o acesso ao workspace imediatamente. As tarefas dela continuam nos projetos.", confirmLabel: "Remover", destructive: true }))) return;
    try {
      await api().removeMember(member.userId);
      toast(`${member.name} foi removido`);
      await load();
    } catch (error) {
      fail(error);
    }
  };
  const revoke = async (invite: WorkspaceInvite) => {
    try {
      await api().revokeInvite(invite.id);
      toast("Convite cancelado");
      await load();
    } catch (error) {
      fail(error);
    }
  };

  const filtered = members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="page">
      <PageHeader
        title="Pessoas"
        subtitle={`${plural(members.length, "pessoa")} em ${snapshot.workspace.name}`}
        actions={
          admin && (
            <button type="button" className="ui-button primary" onClick={() => setInviteOpen(true)}>
              <UserPlus /> Convidar
            </button>
          )
        }
      >
        <div className="page-toolbar">
          <input className="ui-input toolbar-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar pessoas" />
        </div>
      </PageHeader>
      <div className="page-body narrow">
        {loading && !members.length ? (
          <div className="page-loading">
            <Spinner />
          </div>
        ) : (
          <>
            <section className="task-group">
              <header>
                <h2>Membros</h2>
                <span className="count">{filtered.length}</span>
              </header>
              <div className="ui-card people-list">
                {filtered.map((member) => {
                  const self = member.userId === snapshot.user.id;
                  return (
                    <div key={member.userId} className="person-row">
                      <Avatar name={member.name} url={member.avatarUrl} size={36} />
                      <div className="person-main">
                        <strong>
                          {member.name}
                          {self && <span className="subtle"> (você)</span>}
                        </strong>
                        <span>{member.email}</span>
                        {member.role === "guest" && (
                          <small>
                            {member.projectIds.length ? `Acesso a ${plural(member.projectIds.length, "projeto")}` : "Sem projetos liberados"}
                          </small>
                        )}
                      </div>
                      {admin && !self ? (
                        <Popover
                          align="end"
                          width={260}
                          trigger={(props) => (
                            <button {...props} type="button" className="role-button">
                              {roleLabel[member.role]}
                              <MoreHorizontal />
                            </button>
                          )}
                        >
                          {(close) => (
                            <>
                              <MenuLabel>Papel</MenuLabel>
                              {(["admin", "member", "guest"] as WorkspaceRole[]).map((role) => (
                                <MenuItem key={role} checked={member.role === role} onSelect={() => (close(), void changeRole(member, role))} hint={undefined}>
                                  <span className="role-option">
                                    {roleLabel[role]}
                                    <small>{roleHelp[role]}</small>
                                  </span>
                                </MenuItem>
                              ))}
                              {member.role === "guest" && (
                                <MenuItem icon={ShieldCheck} onSelect={() => (close(), setAccess(member))}>
                                  Escolher projetos…
                                </MenuItem>
                              )}
                              <MenuSeparator />
                              <MenuItem icon={Trash2} danger onSelect={() => (close(), void remove(member))}>
                                Remover do workspace
                              </MenuItem>
                            </>
                          )}
                        </Popover>
                      ) : (
                        <Badge tone={member.role === "admin" ? "accent" : "neutral"}>{roleLabel[member.role]}</Badge>
                      )}
                    </div>
                  );
                })}
                {!filtered.length && <EmptyState compact icon={Users} title="Ninguém encontrado" />}
              </div>
            </section>

            {admin && (
              <section className="task-group">
                <header>
                  <h2>Convites pendentes</h2>
                  <span className="count">{invites.length}</span>
                </header>
                <div className="ui-card people-list">
                  {invites.map((invite) => (
                    <div key={invite.id} className="person-row">
                      <span className="invite-icon">
                        <Mail />
                      </span>
                      <div className="person-main">
                        <strong>{invite.email}</strong>
                        <span>
                          {roleLabel[invite.role]} · convidado por {invite.invitedByName} · expira em {formatDate(invite.expiresAt, false)}
                        </span>
                      </div>
                      {invite.inviteUrl && <CopyLink url={invite.inviteUrl} />}
                      <button type="button" className="ui-button small danger-ghost" onClick={() => revoke(invite)}>
                        Cancelar
                      </button>
                    </div>
                  ))}
                  {!invites.length && (
                    <EmptyState compact icon={Mail} title="Nenhum convite pendente" action={<button className="ui-button small" onClick={() => setInviteOpen(true)}><UserPlus /> Convidar alguém</button>} />
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onSent={load} />
      <AccessDialog member={access} onClose={() => setAccess(null)} onSaved={load} />
    </div>
  );
}

function CopyLink({ url }: { url: string }) {
  const toast = useStore((state) => state.toast);
  return (
    <button
      type="button"
      className="ui-button small ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          toast("Link copiado", { tone: "success" });
        } catch {
          toast("Não foi possível copiar. Selecione o link e copie manualmente.", { tone: "error" });
        }
      }}
    >
      <Copy /> Copiar link
    </button>
  );
}

function InviteDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => Promise<void> }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const [form, setForm] = useState({ email: "", role: "member" as WorkspaceRole, projectIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<WorkspaceInvite | null>(null);
  useEffect(() => {
    if (open) {
      setForm({ email: "", role: "member", projectIds: [] });
      setError("");
      setCreated(null);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const invite = await api().createInvite({ email: form.email.trim(), role: form.role, projectIds: form.role === "guest" ? form.projectIds : [] });
      setCreated(invite);
      await onSent();
    } catch (reason) {
      setError(errorMessage(reason, "Não foi possível criar o convite"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={UserPlus}
      title={created ? "Convite criado" : "Convidar para o workspace"}
      description={created ? `Envie o link abaixo para ${created.email}. Ele vale por 7 dias.` : "A pessoa recebe um link seguro para criar a conta e entrar."}
      footer={
        created ? (
          <>
            <button type="button" className="ui-button" onClick={() => setCreated(null)}>
              Convidar outra pessoa
            </button>
            <button type="button" className="ui-button primary" onClick={onClose}>
              Concluir
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ui-button" onClick={onClose}>
              Cancelar
            </button>
            <button className="ui-button primary" form="invite-form" disabled={busy || !form.email.includes("@") || (form.role === "guest" && !form.projectIds.length)}>
              {busy && <Spinner size={14} />}
              Criar convite
            </button>
          </>
        )
      }
    >
      {created ? (
        <div className="invite-result">
          <div className="invite-link">
            <Link2 />
            <input readOnly value={created.inviteUrl ?? ""} onFocus={(event) => event.target.select()} aria-label="Link do convite" />
            {created.inviteUrl && <CopyLink url={created.inviteUrl} />}
          </div>
        </div>
      ) : (
        <form id="invite-form" className="ui-form" onSubmit={submit}>
          <label className="ui-field">
            <span>E-mail</span>
            <input data-autofocus type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nome@empresa.com" />
          </label>
          <div className="ui-field">
            <span>Papel</span>
            <div className="role-cards">
              {(["member", "guest", "admin"] as WorkspaceRole[]).map((role) => (
                <label key={role} className={`role-card ${form.role === role ? "selected" : ""}`}>
                  <input type="radio" name="role" checked={form.role === role} onChange={() => setForm({ ...form, role })} />
                  <strong>{roleLabel[role]}</strong>
                  <small>{roleHelp[role]}</small>
                </label>
              ))}
            </div>
          </div>
          {form.role === "guest" && (
            <div className="ui-field">
              <span>Projetos liberados</span>
              <ProjectChecklist value={form.projectIds} onChange={(projectIds) => setForm({ ...form, projectIds })} projects={snapshot.projects} />
            </div>
          )}
          {error && <div className="ui-alert error">{error}</div>}
        </form>
      )}
    </Dialog>
  );
}

function ProjectChecklist({ value, onChange, projects }: { value: string[]; onChange: (value: string[]) => void; projects: { id: string; name: string; color: string; icon: string }[] }) {
  return (
    <div className="check-list">
      {projects.map((project) => (
        <label key={project.id} className="check-row">
          <input type="checkbox" checked={value.includes(project.id)} onChange={(event) => onChange(event.target.checked ? [...value, project.id] : value.filter((id) => id !== project.id))} />
          <ProjectGlyph icon={project.icon} color={project.color} size={18} />
          {project.name}
        </label>
      ))}
    </div>
  );
}

function AccessDialog({ member, onClose, onSaved }: { member: WorkspaceMember | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setProjectIds(member?.projectIds ?? []), [member]);
  const save = async () => {
    if (!member) return;
    setBusy(true);
    try {
      await api().updateMember({ userId: member.userId, role: member.role, projectIds });
      toast("Acessos atualizados", { tone: "success" });
      await onSaved();
      onClose();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={Boolean(member)}
      onClose={onClose}
      icon={ShieldCheck}
      title={`Projetos de ${member?.name ?? ""}`}
      description="Convidados só veem os projetos marcados."
      size="sm"
      footer={
        <>
          <button type="button" className="ui-button" onClick={onClose}>
            <X /> Cancelar
          </button>
          <button type="button" className="ui-button primary" onClick={save} disabled={busy}>
            Salvar
          </button>
        </>
      }
    >
      <ProjectChecklist value={projectIds} onChange={setProjectIds} projects={snapshot.projects} />
    </Dialog>
  );
}

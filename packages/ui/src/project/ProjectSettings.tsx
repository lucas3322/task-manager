import { FormEvent, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Columns3, FormInput, Plus, RotateCcw, Settings2, Trash2, Workflow, Zap, type LucideIcon } from "lucide-react";
import type { AutomationAction, AutomationActionType, AutomationRun, AutomationTrigger, CustomFieldDefinition, CustomFieldType, ProjectAutomation, ProjectOption, Task } from "@orbitask/contracts";
import { api, errorMessage } from "../api";
import { ColorSwatches, Dialog, EmptyState, Popover, ProjectGlyph, Segmented, Spinner, Switch, confirm } from "../components/primitives";
import { automationActionLabels, customFieldLabels, palette } from "../lib/catalog";
import { formatDateTime, relativeTime } from "../lib/format";
import { IconGrid } from "../shell/Overlays";
import { PageHeader } from "../shell/Sidebar";
import { SettingsGroup, SettingsRow } from "../screens/Settings";
import { useStore, type ProjectSettingsTab } from "../store";

const tabs: { id: ProjectSettingsTab; label: string; icon: LucideIcon }[] = [
  { id: "general", label: "Geral", icon: Settings2 },
  { id: "workflow", label: "Fluxo e etiquetas", icon: Columns3 },
  { id: "fields", label: "Campos personalizados", icon: FormInput },
  { id: "automations", label: "Automações", icon: Zap },
  { id: "trash", label: "Lixeira", icon: Trash2 },
];

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function ProjectSettingsScreen({ projectId, tab }: { projectId: string; tab: ProjectSettingsTab }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const navigate = useStore((state) => state.navigate);
  const loading = useStore((state) => state.loadingProject);
  const loadProject = useStore((state) => state.loadProject);
  const mismatch = snapshot.project.id !== projectId;
  useEffect(() => {
    if (mismatch && !loading) void loadProject(projectId);
  }, [mismatch, projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (mismatch)
    return (
      <div className="page">
        <div className="page-loading full">
          <Spinner />
        </div>
      </div>
    );
  const project = snapshot.project;
  const guest = snapshot.workspace.role === "guest";
  return (
    <div className="page">
      <PageHeader
        breadcrumb={[{ label: project.name, onClick: () => navigate({ name: "project", projectId, view: snapshot.preferences.defaultView }) }]}
        leading={<ProjectGlyph icon={project.icon} color={project.color} size={34} />}
        title="Configurações do projeto"
        actions={
          <button type="button" className="ui-button" onClick={() => navigate({ name: "project", projectId, view: snapshot.preferences.defaultView })}>
            Voltar ao projeto
          </button>
        }
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções do projeto">
          {tabs.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`settings-nav-item ${item.id === tab ? "active" : ""}`}
              aria-current={item.id === tab ? "page" : undefined}
              onClick={() => navigate({ name: "project-settings", projectId, tab: item.id })}
            >
              <span className="settings-nav-icon">
                <item.icon />
              </span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <h2 className="settings-title">{tabs.find((item) => item.id === tab)?.label}</h2>
          {guest && tab !== "trash" ? (
            <div className="ui-alert info">Convidados podem ver, mas não alterar as configurações do projeto.</div>
          ) : (
            <>
              {tab === "general" && <GeneralTab />}
              {tab === "workflow" && <WorkflowTab />}
              {tab === "fields" && <FieldsTab />}
              {tab === "automations" && <AutomationsTab />}
            </>
          )}
          {tab === "trash" && <TrashTab />}
        </div>
      </div>
    </div>
  );
}

function GeneralTab() {
  const snapshot = useStore((state) => state.snapshot)!;
  const updateProject = useStore((state) => state.updateProject);
  const removeProject = useStore((state) => state.removeProject);
  const setDensity = useStore((state) => state.setDensity);
  const setDefaultView = useStore((state) => state.setDefaultView);
  const fail = useStore((state) => state.fail);
  const project = snapshot.project;
  const [form, setForm] = useState({ name: project.name, description: project.description, color: project.color, icon: project.icon });
  const [busy, setBusy] = useState(false);
  /* Depende dos valores, não do objeto: a sincronização periódica não apaga o que está sendo editado. */
  useEffect(() => setForm({ name: project.name, description: project.description, color: project.color, icon: project.icon }), [project.id, project.name, project.description, project.color, project.icon]);
  const dirty = form.name !== project.name || form.description !== project.description || form.color !== project.color || form.icon !== project.icon;
  const admin = snapshot.workspace.role === "admin";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updateProject({ id: project.id, name: form.name.trim(), description: form.description.trim(), color: form.color, icon: form.icon });
    } catch {
      /* erro já exibido */
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    const ok = await confirm({
      title: `Excluir “${project.name}”?`,
      message: "Todas as tarefas, comentários e anexos deste projeto serão excluídos permanentemente.",
      confirmLabel: "Excluir projeto",
      destructive: true,
      requireText: project.name,
    });
    if (!ok) return;
    try {
      await removeProject(project.id);
    } catch (error) {
      fail(error, "Não foi possível excluir o projeto");
    }
  };

  return (
    <>
      <form onSubmit={submit}>
        <SettingsGroup title="Detalhes">
          <div className="settings-form">
            <div className="project-preview">
              <ProjectGlyph icon={form.icon} color={form.color} size={44} />
              <div>
                <strong>{form.name || "Nome do projeto"}</strong>
                <span>{form.description || "Sem descrição"}</span>
              </div>
            </div>
            <label className="ui-field">
              <span>Nome</span>
              <input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="ui-field">
              <span>Descrição</span>
              <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Qual é o objetivo deste projeto?" />
            </label>
            <div className="ui-field">
              <span>Cor</span>
              <ColorSwatches label="Cor" colors={palette} value={form.color} onChange={(color) => setForm({ ...form, color })} />
            </div>
            <div className="ui-field">
              <span>Ícone</span>
              <IconGrid value={form.icon} color={form.color} onChange={(icon) => setForm({ ...form, icon })} />
            </div>
          </div>
        </SettingsGroup>
        <div className="settings-actions">
          <button type="button" className="ui-button" disabled={!dirty} onClick={() => setForm({ name: project.name, description: project.description, color: project.color, icon: project.icon })}>
            Descartar
          </button>
          <button className="ui-button primary" disabled={!dirty || busy || !form.name.trim()}>
            {busy && <Spinner size={14} />}
            Salvar alterações
          </button>
        </div>
      </form>
      <SettingsGroup title="Suas preferências" description="Valem só para você neste projeto.">
        <SettingsRow label="Visualização padrão" description="Qual visualização abre primeiro.">
          <Segmented
            label="Visualização padrão"
            size="sm"
            value={snapshot.preferences.defaultView}
            onChange={(view) => void setDefaultView(view)}
            options={[
              { value: "board", label: "Quadro" },
              { value: "list", label: "Lista" },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Cartões compactos" description="Mostra só título, prazo e responsável no quadro.">
          <Switch label="Cartões compactos" checked={snapshot.preferences.cardDensity === "compact"} onChange={(value) => void setDensity(value ? "compact" : "detailed")} />
        </SettingsRow>
      </SettingsGroup>
      {admin && (
        <SettingsGroup title="Zona de perigo">
          <SettingsRow label="Excluir projeto" description={snapshot.projects.length <= 1 ? "O workspace precisa manter pelo menos um projeto." : "Remove o projeto e todo o seu conteúdo."}>
            <button type="button" className="ui-button danger-ghost" disabled={snapshot.projects.length <= 1} onClick={remove}>
              <Trash2 /> Excluir
            </button>
          </SettingsRow>
        </SettingsGroup>
      )}
    </>
  );
}

function OptionEditor({ title, description, items, onChange, minimum = 0, noun }: { title: string; description: string; items: ProjectOption[]; onChange: (items: ProjectOption[]) => void; minimum?: number; noun: string }) {
  const update = (id: string, change: Partial<ProjectOption>) => onChange(items.map((item) => (item.id === id ? { ...item, ...change } : item)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next.map((value, position) => ({ ...value, position })));
  };
  return (
    <SettingsGroup
      title={title}
      description={description}
      footer={
        <button type="button" className="ui-button small" onClick={() => onChange([...items, { id: newId(), name: "", color: palette[items.length % palette.length], position: items.length }])}>
          <Plus /> Adicionar {noun}
        </button>
      }
    >
      {items.map((item, index) => (
        <div key={item.id} className="option-row">
          <Popover
            width={236}
            trigger={(props) => (
              <button {...props} type="button" className="option-color" style={{ background: item.color }} aria-label="Escolher cor" />
            )}
          >
            {(close) => (
              <div className="color-popover">
                <ColorSwatches label="Cor" colors={palette} value={item.color} onChange={(color) => (update(item.id, { color }), close())} />
              </div>
            )}
          </Popover>
          <input className="option-name" value={item.name} placeholder={`Nome da ${noun}`} onChange={(event) => update(item.id, { name: event.target.value })} aria-label={`Nome da ${noun}`} />
          <button type="button" className="ui-icon-button small" aria-label="Mover para cima" disabled={index === 0} onClick={() => move(index, -1)}>
            <ArrowUp />
          </button>
          <button type="button" className="ui-icon-button small" aria-label="Mover para baixo" disabled={index === items.length - 1} onClick={() => move(index, 1)}>
            <ArrowDown />
          </button>
          <button type="button" className="ui-icon-button small" aria-label={`Remover ${item.name}`} disabled={items.length <= minimum} onClick={() => onChange(items.filter((value) => value.id !== item.id))}>
            <Trash2 />
          </button>
        </div>
      ))}
      {!items.length && <div className="option-empty">Nenhuma {noun} ainda</div>}
    </SettingsGroup>
  );
}

function WorkflowTab() {
  const snapshot = useStore((state) => state.snapshot)!;
  const refresh = useStore((state) => state.refresh);
  const toast = useStore((state) => state.toast);
  const initial = () => ({
    statuses: snapshot.statuses.map((status) => ({ ...status })),
    priorities: [...snapshot.settings.priorities].sort((a, b) => a.position - b.position),
    tags: [...snapshot.settings.tags].sort((a, b) => a.position - b.position),
    badges: [...snapshot.settings.badges].sort((a, b) => a.position - b.position),
  });
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(state) !== JSON.stringify(initial());

  const save = async () => {
    setBusy(true);
    setError("");
    const positioned = (items: ProjectOption[]) => items.map((item, position) => ({ ...item, name: item.name.trim(), position }));
    try {
      await api().updateProjectSettings({ projectId: snapshot.project.id, statuses: positioned(state.statuses), priorities: positioned(state.priorities), tags: positioned(state.tags), badges: positioned(state.badges) });
      await refresh();
      toast("Fluxo atualizado", { tone: "success" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  const savedKey = JSON.stringify(initial());
  useEffect(() => {
    if (!busy) setState(initial());
  }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <OptionEditor title="Colunas do quadro" description="A última coluna representa tarefas concluídas." items={state.statuses} minimum={1} noun="coluna" onChange={(statuses) => setState({ ...state, statuses })} />
      <OptionEditor title="Prioridades" description="Da menos para a mais urgente." items={state.priorities} minimum={1} noun="prioridade" onChange={(priorities) => setState({ ...state, priorities })} />
      <OptionEditor title="Tags" description="Categorize tarefas por tema, área ou tipo." items={state.tags} noun="tag" onChange={(tags) => setState({ ...state, tags })} />
      <OptionEditor title="Selos" description="Destaques visuais como “Bloqueado” ou “Cliente”." items={state.badges} noun="selo" onChange={(badges) => setState({ ...state, badges })} />
      {error && <div className="ui-alert error">{error}</div>}
      <div className="settings-actions sticky">
        <button type="button" className="ui-button" disabled={!dirty} onClick={() => setState(initial())}>
          Descartar
        </button>
        <button type="button" className="ui-button primary" disabled={!dirty || busy} onClick={save}>
          {busy && <Spinner size={14} />}
          Salvar fluxo
        </button>
      </div>
    </>
  );
}

function FieldsTab() {
  const snapshot = useStore((state) => state.snapshot)!;
  const patchSnapshot = useStore((state) => state.patchSnapshot);
  const toast = useStore((state) => state.toast);
  const [fields, setFields] = useState<CustomFieldDefinition[]>(snapshot.customFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(fields) !== JSON.stringify(snapshot.customFields);
  const update = (id: string, change: Partial<CustomFieldDefinition>) => setFields(fields.map((field) => (field.id === id ? { ...field, ...change } : field)));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await api().updateCustomFields({ projectId: snapshot.project.id, fields: fields.map((field, position) => ({ ...field, name: field.name.trim(), position })) });
      patchSnapshot((current) => ({ ...current, customFields: saved }));
      setFields(saved);
      toast("Campos salvos", { tone: "success" });
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="settings-intro">Campos personalizados guardam informações específicas do seu processo, como orçamento, cliente ou estimativa. Eles aparecem no painel da tarefa e nos cartões.</p>
      {!fields.length && (
        <div className="ui-card">
          <EmptyState compact icon={FormInput} title="Nenhum campo personalizado" />
        </div>
      )}
      {fields.map((field) => (
        <SettingsGroup key={field.id}>
          <div className="field-editor">
            <div className="ui-form-row">
              <label className="ui-field">
                <span>Nome do campo</span>
                <input value={field.name} onChange={(event) => update(field.id, { name: event.target.value })} placeholder="Ex.: Orçamento" />
              </label>
              <label className="ui-field">
                <span>Tipo</span>
                <select value={field.type} onChange={(event) => update(field.id, { type: event.target.value as CustomFieldType, options: ["single", "multi"].includes(event.target.value) && !field.options.length ? [{ id: newId(), label: "Opção 1", color: palette[0] }] : field.options })}>
                  {Object.entries(customFieldLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(field.type === "single" || field.type === "multi") && (
              <div className="ui-field">
                <span>Opções</span>
                {field.options.map((option) => (
                  <div key={option.id} className="option-row bare">
                    <Popover width={236} trigger={(props) => <button {...props} type="button" className="option-color" style={{ background: option.color }} aria-label="Cor da opção" />}>
                      {(close) => (
                        <div className="color-popover">
                          <ColorSwatches label="Cor" colors={palette} value={option.color} onChange={(color) => (update(field.id, { options: field.options.map((item) => (item.id === option.id ? { ...item, color } : item)) }), close())} />
                        </div>
                      )}
                    </Popover>
                    <input className="option-name" value={option.label} onChange={(event) => update(field.id, { options: field.options.map((item) => (item.id === option.id ? { ...item, label: event.target.value } : item)) })} />
                    <button type="button" className="ui-icon-button small" aria-label="Remover opção" disabled={field.options.length <= 1} onClick={() => update(field.id, { options: field.options.filter((item) => item.id !== option.id) })}>
                      <Trash2 />
                    </button>
                  </div>
                ))}
                <button type="button" className="link-button" onClick={() => update(field.id, { options: [...field.options, { id: newId(), label: `Opção ${field.options.length + 1}`, color: palette[field.options.length % palette.length] }] })}>
                  <Plus /> Adicionar opção
                </button>
              </div>
            )}
            <div className="field-editor-footer">
              <button type="button" className="ui-button small danger-ghost" onClick={() => setFields(fields.filter((item) => item.id !== field.id))}>
                <Trash2 /> Remover campo
              </button>
            </div>
          </div>
        </SettingsGroup>
      ))}
      <button type="button" className="ui-button" onClick={() => setFields([...fields, { id: newId(), projectId: snapshot.project.id, name: "", type: "text", options: [], position: fields.length }])}>
        <Plus /> Novo campo
      </button>
      {error && <div className="ui-alert error">{error}</div>}
      <div className="settings-actions sticky">
        <button type="button" className="ui-button" disabled={!dirty} onClick={() => setFields(snapshot.customFields)}>
          Descartar
        </button>
        <button type="button" className="ui-button primary" disabled={!dirty || busy || fields.some((field) => !field.name.trim())} onClick={save}>
          {busy && <Spinner size={14} />}
          Salvar campos
        </button>
      </div>
    </>
  );
}

function AutomationsTab() {
  const snapshot = useStore((state) => state.snapshot)!;
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const [data, setData] = useState<{ automations: ProjectAutomation[]; runs: AutomationRun[] } | null>(null);
  const [editing, setEditing] = useState<ProjectAutomation | "new" | null>(null);
  const admin = snapshot.workspace.role === "admin";

  const load = () =>
    api()
      .listAutomations(snapshot.project.id)
      .then(setData)
      .catch((error) => {
        setData({ automations: [], runs: [] });
        fail(error);
      });
  useEffect(() => {
    void load();
  }, [snapshot.project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (automation: ProjectAutomation, enabled: boolean) => {
    try {
      await api().saveAutomation({ ...automation, enabled });
      await load();
    } catch (error) {
      fail(error);
    }
  };
  const remove = async (automation: ProjectAutomation) => {
    if (!(await confirm({ title: `Excluir “${automation.name}”?`, confirmLabel: "Excluir", destructive: true }))) return;
    try {
      await api().removeAutomation(automation.id);
      toast("Automação excluída");
      await load();
    } catch (error) {
      fail(error);
    }
  };

  const describe = (automation: ProjectAutomation) => {
    const trigger = automation.trigger === "task_created" ? "Quando uma tarefa é criada" : `Quando uma tarefa vai para “${snapshot.statuses.find((status) => status.id === automation.triggerValue)?.name ?? "qualquer coluna"}”`;
    return `${trigger} → ${automation.actions.map((action) => automationActionLabels[action.type].toLowerCase()).join(", ")}`;
  };

  if (!data)
    return (
      <div className="page-loading small">
        <Spinner />
      </div>
    );
  return (
    <>
      <p className="settings-intro">Automações fazem o trabalho repetitivo: mover, atribuir, etiquetar ou definir prazos quando algo acontece.</p>
      <SettingsGroup
        footer={
          admin && (
            <button type="button" className="ui-button small" onClick={() => setEditing("new")}>
              <Plus /> Nova automação
            </button>
          )
        }
      >
        {data.automations.map((automation) => (
          <div key={automation.id} className="automation-row">
            <span className="automation-icon">
              <Workflow />
            </span>
            <button type="button" className="automation-main" onClick={() => admin && setEditing(automation)} disabled={!admin}>
              <strong>{automation.name}</strong>
              <span>{describe(automation)}</span>
            </button>
            {admin && <Switch label="Ativa" checked={automation.enabled} onChange={(value) => void toggle(automation, value)} />}
            {admin && (
              <button type="button" className="ui-icon-button small" aria-label="Excluir" onClick={() => remove(automation)}>
                <Trash2 />
              </button>
            )}
          </div>
        ))}
        {!data.automations.length && <EmptyState compact icon={Zap} title="Nenhuma automação ainda" />}
      </SettingsGroup>
      {data.runs.length > 0 && (
        <SettingsGroup title="Execuções recentes">
          {data.runs.slice(0, 12).map((run) => (
            <div key={run.id} className="run-row">
              <span className={`run-status ${run.status}`} />
              <span className="run-message">
                <strong>{data.automations.find((item) => item.id === run.automationId)?.name ?? "Automação"}</strong> {run.message}
              </span>
              <span className="subtle small-text" title={formatDateTime(run.createdAt)}>
                {relativeTime(run.createdAt)}
              </span>
            </div>
          ))}
        </SettingsGroup>
      )}
      <AutomationDialog editing={editing} onClose={() => setEditing(null)} onSaved={load} />
    </>
  );
}

function AutomationDialog({ editing, onClose, onSaved }: { editing: ProjectAutomation | "new" | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const snapshot = useStore((state) => state.snapshot)!;
  const toast = useStore((state) => state.toast);
  const blank = { name: "", enabled: true, trigger: "task_created" as AutomationTrigger, triggerValue: "" as string, actions: [{ id: newId(), type: "set_priority" as AutomationActionType, value: "" }] as AutomationAction[] };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!editing) return;
    setError("");
    setForm(editing === "new" ? blank : { name: editing.name, enabled: editing.enabled, trigger: editing.trigger, triggerValue: editing.triggerValue ?? "", actions: editing.actions });
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueOptions = (type: AutomationActionType) =>
    type === "set_status"
      ? snapshot.statuses.map((item) => ({ id: item.id, label: item.name }))
      : type === "set_priority"
        ? snapshot.settings.priorities.map((item) => ({ id: item.id, label: item.name }))
        : type === "assign_user"
          ? snapshot.members.map((item) => ({ id: item.userId, label: item.name }))
          : type === "add_tag"
            ? snapshot.settings.tags.map((item) => ({ id: item.id, label: item.name }))
            : null;
  const setAction = (id: string, change: Partial<AutomationAction>) => setForm({ ...form, actions: form.actions.map((action) => (action.id === id ? { ...action, ...change } : action)) });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api().saveAutomation({ id: editing && editing !== "new" ? editing.id : undefined, projectId: snapshot.project.id, name: form.name.trim(), enabled: form.enabled, trigger: form.trigger, triggerValue: form.trigger === "status_changed" ? form.triggerValue || null : null, actions: form.actions });
      toast("Automação salva", { tone: "success" });
      await onSaved();
      onClose();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={Boolean(editing)}
      onClose={onClose}
      icon={Zap}
      size="lg"
      title={editing === "new" ? "Nova automação" : "Editar automação"}
      footer={
        <>
          <button type="button" className="ui-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="ui-button primary" form="automation-form" disabled={busy || !form.name.trim() || form.actions.some((action) => !action.value)}>
            {busy && <Spinner size={14} />}
            Salvar automação
          </button>
        </>
      }
    >
      <form id="automation-form" className="ui-form" onSubmit={submit}>
        <label className="ui-field">
          <span>Nome</span>
          <input data-autofocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Novas tarefas entram como alta prioridade" />
        </label>
        <div className="automation-block">
          <span className="automation-step">Quando</span>
          <div className="ui-form-row">
            <select className="ui-select" value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value as AutomationTrigger })}>
              <option value="task_created">Uma tarefa for criada</option>
              <option value="status_changed">Uma tarefa mudar de coluna</option>
            </select>
            {form.trigger === "status_changed" && (
              <select className="ui-select" value={form.triggerValue} onChange={(event) => setForm({ ...form, triggerValue: event.target.value })}>
                <option value="">Para qualquer coluna</option>
                {snapshot.statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    Para “{status.name}”
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="automation-block">
          <span className="automation-step">Então</span>
          {form.actions.map((action) => {
            const options = valueOptions(action.type);
            return (
              <div key={action.id} className="automation-action">
                <select className="ui-select" value={action.type} onChange={(event) => setAction(action.id, { type: event.target.value as AutomationActionType, value: "" })}>
                  {Object.entries(automationActionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {options ? (
                  <select className="ui-select" value={action.value} onChange={(event) => setAction(action.id, { value: event.target.value })}>
                    <option value="">Escolha…</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="ui-input" type={action.type === "set_due_days" ? "number" : "text"} min={0} value={action.value} onChange={(event) => setAction(action.id, { value: event.target.value })} placeholder={action.type === "set_due_days" ? "Dias" : "Título da subtarefa"} />
                )}
                <button type="button" className="ui-icon-button small" aria-label="Remover ação" disabled={form.actions.length <= 1} onClick={() => setForm({ ...form, actions: form.actions.filter((item) => item.id !== action.id) })}>
                  <Trash2 />
                </button>
              </div>
            );
          })}
          <button type="button" className="link-button" onClick={() => setForm({ ...form, actions: [...form.actions, { id: newId(), type: "assign_user", value: "" }] })}>
            <Plus /> Adicionar ação
          </button>
        </div>
        {error && <div className="ui-alert error">{error}</div>}
      </form>
    </Dialog>
  );
}

function TrashTab() {
  const snapshot = useStore((state) => state.snapshot)!;
  const refresh = useStore((state) => state.refresh);
  const fail = useStore((state) => state.fail);
  const toast = useStore((state) => state.toast);
  const [items, setItems] = useState<Task[] | null>(null);
  const load = () =>
    api()
      .listTrash(snapshot.project.id)
      .then(setItems)
      .catch((error) => {
        setItems([]);
        fail(error);
      });
  useEffect(() => {
    void load();
  }, [snapshot.project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const restore = async (task: Task) => {
    try {
      await api().restoreTask(task.id);
      setItems((current) => current?.filter((item) => item.id !== task.id) ?? null);
      await refresh();
      toast(`“${task.title}” restaurada`, { tone: "success" });
    } catch (error) {
      fail(error);
    }
  };
  return (
    <>
      <p className="settings-intro">Tarefas excluídas ficam aqui e podem ser restauradas a qualquer momento.</p>
      <SettingsGroup>
        {!items && (
          <div className="page-loading small">
            <Spinner />
          </div>
        )}
        {items?.map((task) => (
          <div key={task.id} className="trash-row">
            <div>
              <strong>{task.title}</strong>
              <span>Excluída {task.deletedAt ? relativeTime(task.deletedAt) : ""}</span>
            </div>
            <button type="button" className="ui-button small" onClick={() => restore(task)}>
              <RotateCcw /> Restaurar
            </button>
          </div>
        ))}
        {items && !items.length && <EmptyState compact icon={Trash2} title="A lixeira está vazia" />}
      </SettingsGroup>
    </>
  );
}

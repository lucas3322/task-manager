import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { DndContext, DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BarChart3, Bell, CheckSquare2, ChevronDown, CircleHelp, FileText, LayoutDashboard, List, Map, MoreHorizontal, Plus, Search, Settings, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { create } from 'zustand'
import type { Priority, Status, Task, WorkspaceSnapshot } from '@orbitask/contracts'
import './styles.css'

type View = 'board' | 'list'
interface Store {
  snapshot: WorkspaceSnapshot | null
  view: View
  query: string
  load(): Promise<void>
  setView(view: View): void
  setQuery(query: string): void
  createTask(statusId: string, title: string): Promise<void>
  moveTask(id: string, statusId: string): Promise<void>
}

const useStore = create<Store>((set, get) => ({
  snapshot: null,
  view: 'board',
  query: '',
  load: async () => set({ snapshot: await window.orbitask.getSnapshot() }),
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  createTask: async (statusId, title) => {
    const snapshot = get().snapshot
    if (!snapshot) return
    const task = await window.orbitask.createTask({ projectId: snapshot.project.id, statusId, title })
    set({ snapshot: { ...snapshot, tasks: [...snapshot.tasks, task] } })
  },
  moveTask: async (id, statusId) => {
    const snapshot = get().snapshot
    if (!snapshot) return
    const task = await window.orbitask.moveTask({ id, statusId, position: Date.now() })
    set({ snapshot: { ...snapshot, tasks: snapshot.tasks.map((item) => item.id === id ? task : item) } })
  },
}))

const priorityLabels: Record<Priority, string> = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' }

function Sidebar() {
  return <aside className="sidebar">
    <div className="brand"><span className="logo"><Sparkles size={18} /></span><strong>orbitask</strong><ChevronDown size={14} /></div>
    <button className="create"><Plus size={17} /> Criar</button>
    <nav>
      <a><LayoutDashboard size={17} /> Visão geral</a><a><CheckSquare2 size={17} /> Minhas tarefas <span>4</span></a><a><Bell size={17} /> Caixa de entrada <i></i></a>
    </nav>
    <div className="nav-title">Workspace <button><Plus size={15} /></button></div>
    <nav><a className="active"><span className="project-dot"></span> Lançamento do produto</a><a><span className="project-dot blue"></span> Marketing</a><a><span className="project-dot green"></span> Operações</a></nav>
    <div className="nav-title">Favoritos</div>
    <nav><a><FileText size={17} /> Briefing do produto</a><a><BarChart3 size={17} /> Metas do trimestre</a></nav>
    <div className="sidebar-bottom"><a><Users size={17} /> Convidar pessoas</a><a><CircleHelp size={17} /> Ajuda e recursos</a></div>
  </aside>
}

function TaskCard({ task }: { task: Task }) {
  return <article className="task-card" draggable={false}>
    <div className="task-top"><span className={`priority ${task.priority}`}>{priorityLabels[task.priority]}</span><MoreHorizontal size={17} /></div>
    <h3>{task.title}</h3>
    <p>{task.description || 'Adicione contexto e detalhes para sua equipe.'}</p>
    <div className="task-footer"><span className="avatar">LP</span><span className="task-meta"><CheckSquare2 size={14} /> 0/3</span></div>
  </article>
}

function Column({ status, tasks }: { status: Status; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id })
  const createTask = useStore((state) => state.createTask)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const submit = async () => { if (!title.trim()) return; await createTask(status.id, title); setTitle(''); setAdding(false) }
  return <section ref={setNodeRef} className={`column ${isOver ? 'over' : ''}`}>
    <header><span className="status-dot" style={{ background: status.color }}></span><strong>{status.name}</strong><em>{tasks.length}</em><button onClick={() => setAdding(true)}><Plus size={17} /></button></header>
    <div className="cards">{tasks.map((task) => <DraggableTask key={task.id} task={task} />)}</div>
    {adding ? <div className="quick-add"><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit(); if (event.key === 'Escape') setAdding(false) }} placeholder="Nome da tarefa"/><button onClick={submit}>Adicionar</button></div> : <button className="add-task" onClick={() => setAdding(true)}><Plus size={16} /> Adicionar tarefa</button>}
  </section>
}

function DraggableTask({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  return <div ref={setNodeRef} {...listeners} {...attributes} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? .5 : 1 }}><TaskCard task={task} /></div>
}

function Board({ snapshot, tasks }: { snapshot: WorkspaceSnapshot; tasks: Task[] }) {
  const moveTask = useStore((state) => state.moveTask)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const dragEnd = (event: DragEndEvent) => { if (event.over) moveTask(String(event.active.id), String(event.over.id)) }
  return <DndContext sensors={sensors} onDragEnd={dragEnd}><div className="board">{snapshot.statuses.map((status) => <Column key={status.id} status={status} tasks={tasks.filter((task) => task.statusId === status.id)} />)}</div></DndContext>
}

function ListView({ snapshot, tasks }: { snapshot: WorkspaceSnapshot; tasks: Task[] }) {
  return <div className="list-view"><div className="list-head"><span>Tarefa</span><span>Status</span><span>Prioridade</span><span>Responsável</span></div>{tasks.map((task) => { const status = snapshot.statuses.find((item) => item.id === task.statusId); return <div className="list-row" key={task.id}><strong>{task.title}</strong><span><i style={{ background: status?.color }}></i>{status?.name}</span><span className={`priority ${task.priority}`}>{priorityLabels[task.priority]}</span><span><b className="avatar">LP</b> Lucas</span></div> })}</div>
}

function App() {
  const { snapshot, load, view, setView, query, setQuery } = useStore()
  useEffect(() => { load() }, [load])
  const filtered = useMemo(() => snapshot?.tasks.filter((task) => task.title.toLowerCase().includes(query.toLowerCase())) ?? [], [snapshot, query])
  if (!snapshot) return <div className="loading"><span className="logo"><Sparkles /></span> Preparando seu workspace...</div>
  return <div className="shell"><Sidebar /><main>
    <div className="topbar"><div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tarefas, projetos e pessoas..."/><kbd>⌘ K</kbd></div><button className="icon-button"><Bell size={19} /></button><div className="avatar">LP</div></div>
    <div className="project-header"><div><p>Projetos / Produto</p><h1><span className="project-icon">L</span>{snapshot.project.name}<button><ChevronDown size={16} /></button></h1></div><div className="header-actions"><button><Users size={17} /> Compartilhar</button><button className="icon-button"><MoreHorizontal size={19}/></button></div></div>
    <div className="viewbar"><div className="views"><button onClick={() => setView('board')} className={view === 'board' ? 'selected' : ''}><LayoutDashboard size={16}/> Quadro</button><button onClick={() => setView('list')} className={view === 'list' ? 'selected' : ''}><List size={16}/> Lista</button><button disabled><BarChart3 size={16}/> Gantt <small>em breve</small></button><button disabled><Map size={16}/> Mapa</button></div><button><SlidersHorizontal size={16}/> Filtrar</button><button><Settings size={16}/> Personalizar</button></div>
    <div className="content">{view === 'board' ? <Board snapshot={snapshot} tasks={filtered} /> : <ListView snapshot={snapshot} tasks={filtered} />}</div>
  </main></div>
}

const client = new QueryClient()
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><App /></QueryClientProvider></React.StrictMode>)

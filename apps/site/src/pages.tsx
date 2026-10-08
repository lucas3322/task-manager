import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Command,
  Download,
  GanttChart,
  Globe,
  KeyRound,
  Laptop,
  LayoutDashboard,
  List,
  ListChecks,
  Lock,
  Menu,
  Monitor,
  MessageSquare,
  Search,
  ShieldCheck,
  Target,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@orbitask/ui/logo";

const VERSION = "0.4.0";
const RELEASES_URL = "https://github.com/lucas3322/task-manager/releases/latest/download";
const downloads = {
  mac: (import.meta.env.VITE_DOWNLOAD_MAC_URL as string | undefined) || `${RELEASES_URL}/Orbitask-mac-universal.dmg`,
  windows: (import.meta.env.VITE_DOWNLOAD_WINDOWS_URL as string | undefined) || `${RELEASES_URL}/Orbitask-windows-setup.exe`,
};

/* ---------- Moldura ---------- */

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { href: "/#recursos", label: "Recursos" },
    { href: "/#visualizacoes", label: "Visualizações" },
    { href: "/#como-funciona", label: "Como funciona" },
    { href: "/download", label: "Desktop" },
    { href: "/novidades", label: "Novidades" },
  ];
  return (
    <header className={`site-nav ${scrolled ? "scrolled" : ""} ${open ? "open" : ""}`}>
      <div className="site-nav-inner">
        <a href="/" className="site-brand" aria-label="Orbitask, página inicial">
          <LogoMark size={28} />
          <span>Orbitask</span>
        </a>
        <nav className="site-links" aria-label="Principal">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="site-nav-actions">
          <a href="/app" className="site-login">
            Entrar
          </a>
          <a href="/app?cadastro=1" className="site-button primary small">
            Começar grátis
          </a>
          <button type="button" className="site-menu" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <a href="/" className="site-brand">
            <LogoMark size={26} />
            <span>Orbitask</span>
          </a>
          <p>Projetos claros. Equipes no ritmo.</p>
        </div>
        <div className="site-footer-cols">
          <div>
            <h4>Produto</h4>
            <a href="/#recursos">Recursos</a>
            <a href="/#visualizacoes">Visualizações</a>
            <a href="/novidades">Novidades</a>
          </div>
          <div>
            <h4>Acesso</h4>
            <a href="/app">App web</a>
            <a href="/download">Orbitask Desktop</a>
            <a href="/app?cadastro=1">Criar conta</a>
          </div>
          <div>
            <h4>Ajuda</h4>
            <a href="/#perguntas">Perguntas frequentes</a>
            <a href="/#seguranca">Segurança</a>
          </div>
        </div>
      </div>
      <div className="site-footer-bottom">
        <small>© 2026 Orbitask · versão {VERSION}</small>
      </div>
    </footer>
  );
}

function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!("IntersectionObserver" in window)) return items.forEach((item) => item.classList.add("revealed"));
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
}

/* ---------- Mockups do produto (HTML real, não imagem) ---------- */

interface MockCard { t: string; tag: [string, string]; due: string; who: string[]; today?: boolean; late?: boolean; done?: boolean; progress?: string }
const mockColumns: { name: string; color: string; cards: MockCard[] }[] = [
  { name: "A fazer", color: "#8a8a92", cards: [{ t: "Pesquisa com 8 clientes", tag: ["Pesquisa", "#2f7ff0"], due: "Sex", who: ["AM"] }, { t: "Definir métricas de ativação", tag: ["Produto", "#6559e8"], due: "12 out", who: ["LP", "JS"] }] },
  { name: "Em andamento", color: "#2f7ff0", cards: [{ t: "Novo fluxo de onboarding", tag: ["Design", "#d6409f"], due: "Hoje", who: ["RC"], today: true, progress: "3/5" }, { t: "Integração com calendário", tag: ["Eng", "#30a46c"], due: "Amanhã", who: ["JS"] }] },
  { name: "Em revisão", color: "#e8a33a", cards: [{ t: "Página de preços", tag: ["Marketing", "#f07a3a"], due: "Ontem", who: ["AM"], late: true }] },
  { name: "Concluído", color: "#30a46c", cards: [{ t: "Kickoff do lançamento", tag: ["Produto", "#6559e8"], due: "2 out", who: ["LP"], done: true }, { t: "Roteiro do vídeo", tag: ["Marketing", "#f07a3a"], due: "1 out", who: ["RC"], done: true }] },
];

function MockAvatar({ initials }: { initials: string }) {
  const hue = [...initials].reduce((sum, char) => sum + char.charCodeAt(0), 0) * 37 % 360;
  return (
    <i className="mock-avatar" style={{ "--h": hue } as React.CSSProperties}>
      {initials}
    </i>
  );
}

function MockBoard() {
  return (
    <div className="mock-board">
      {mockColumns.map((column) => (
        <div key={column.name} className="mock-column">
          <div className="mock-column-head">
            <i style={{ background: column.color }} />
            {column.name}
            <span>{column.cards.length}</span>
          </div>
          {column.cards.map((card) => (
            <div key={card.t} className={`mock-card ${card.done ? "done" : ""}`}>
              <span className="mock-pill" style={{ "--c": card.tag[1] } as React.CSSProperties}>
                {card.tag[0]}
              </span>
              <b>{card.t}</b>
              <div className="mock-card-meta">
                <span className={`mock-due ${card.late ? "late" : card.today ? "today" : ""}`}>{card.due}</span>
                {card.progress && (
                  <span className="mock-count">
                    <ListChecks /> {card.progress}
                  </span>
                )}
                <span className="mock-people">
                  {card.who.map((who) => (
                    <MockAvatar key={who} initials={who} />
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MockList() {
  const rows = mockColumns.flatMap((column) => column.cards.map((card) => ({ ...card, status: column.name, color: column.color })));
  return (
    <div className="mock-list">
      {rows.map((row) => (
        <div key={row.t} className={`mock-row ${row.done ? "done" : ""}`}>
          <span className="mock-check">{row.done && <Check />}</span>
          <b>{row.t}</b>
          <span className="mock-people">
            {row.who.map((who) => (
              <MockAvatar key={who} initials={who} />
            ))}
          </span>
          <span className={`mock-due ${row.late ? "late" : row.today ? "today" : ""}`}>{row.due}</span>
          <span className="mock-pill" style={{ "--c": row.color } as React.CSSProperties}>
            {row.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function MockCalendar() {
  const events: Record<number, [string, string][]> = { 3: [["Kickoff", "#30a46c"]], 8: [["Pesquisa", "#2f7ff0"]], 9: [["Onboarding", "#d6409f"], ["Preços", "#f07a3a"]], 10: [["Calendário", "#30a46c"]], 14: [["Métricas", "#6559e8"]], 17: [["Beta fechado", "#e8a33a"]], 23: [["Lançamento", "#e5484d"]] };
  return (
    <div className="mock-calendar">
      {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
        <span key={index} className="mock-weekday">
          {day}
        </span>
      ))}
      {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
        <div key={day} className={`mock-day ${day === 9 ? "today" : ""}`}>
          <span>{day}</span>
          {events[day]?.map(([label, color]) => (
            <i key={label} style={{ "--c": color } as React.CSSProperties}>
              {label}
            </i>
          ))}
        </div>
      ))}
    </div>
  );
}

function MockTimeline() {
  const bars: [string, number, number, string][] = [
    ["Pesquisa com clientes", 0, 5, "#2f7ff0"],
    ["Novo onboarding", 3, 8, "#d6409f"],
    ["Integração com calendário", 5, 6, "#30a46c"],
    ["Página de preços", 8, 4, "#f07a3a"],
    ["Beta fechado", 11, 5, "#e8a33a"],
    ["Lançamento", 16, 3, "#e5484d"],
  ];
  return (
    <div className="mock-timeline">
      {bars.map(([label, start, length, color]) => (
        <div key={label} className="mock-tl-row">
          <span>{label}</span>
          <div>
            <i style={{ left: `${(start / 20) * 100}%`, width: `${(length / 20) * 100}%`, "--c": color } as React.CSSProperties}>{label}</i>
          </div>
        </div>
      ))}
      <span className="mock-tl-today" />
    </div>
  );
}

function ProductWindow({ view = "board" }: { view?: "board" | "list" | "calendar" | "timeline" }) {
  const tabs: [typeof view, string, LucideIcon][] = [
    ["board", "Quadro", Columns3],
    ["list", "Lista", List],
    ["calendar", "Calendário", CalendarDays],
    ["timeline", "Cronograma", GanttChart],
  ];
  return (
    <div className="product-window" aria-hidden="true">
      <div className="pw-sidebar">
        <div className="pw-traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="pw-workspace">
          <span>A</span>
          <b>Acme</b>
        </div>
        <div className="pw-search">
          <Search /> Buscar <kbd>⌘K</kbd>
        </div>
        <p className="pw-nav">
          <LayoutDashboard /> Início
        </p>
        <p className="pw-nav">
          <Check /> Minhas tarefas
        </p>
        <p className="pw-nav">
          <Bell /> Caixa de entrada <em>3</em>
        </p>
        <p className="pw-nav">
          <Target /> Metas
        </p>
        <small>Projetos</small>
        <p className="pw-nav active">
          <i style={{ background: "#6559e8" }} /> Lançamento do app
        </p>
        <p className="pw-nav">
          <i style={{ background: "#f07a3a" }} /> Marketing
        </p>
        <p className="pw-nav">
          <i style={{ background: "#30a46c" }} /> Operações
        </p>
      </div>
      <div className="pw-main">
        <div className="pw-header">
          <div>
            <small>Projetos /</small>
            <b>Lançamento do app</b>
          </div>
          <span className="pw-people">
            <MockAvatar initials="LP" />
            <MockAvatar initials="AM" />
            <MockAvatar initials="RC" />
          </span>
          <span className="pw-cta">+ Nova tarefa</span>
        </div>
        <div className="pw-tabs">
          {tabs.map(([id, label, Icon]) => (
            <span key={id} className={view === id ? "active" : ""}>
              <Icon /> {label}
            </span>
          ))}
        </div>
        <div className="pw-content">
          {view === "board" && <MockBoard />}
          {view === "list" && <MockList />}
          {view === "calendar" && <MockCalendar />}
          {view === "timeline" && <MockTimeline />}
        </div>
      </div>
    </div>
  );
}

/* ---------- Landing ---------- */

const features: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  { icon: Columns3, title: "Quatro jeitos de ver o mesmo trabalho", text: "Quadro, lista, calendário e cronograma sempre sincronizados. Arraste um cartão e todas as visões se atualizam.", tone: "violet" },
  { icon: ListChecks, title: "Tarefas com tudo o que importa", text: "Responsáveis, prazos, subtarefas, checklists, dependências, links e campos personalizados no mesmo painel.", tone: "blue" },
  { icon: Zap, title: "Automações sem código", text: "Quando uma tarefa nasce ou muda de coluna, o Orbitask atribui, prioriza, etiqueta e define prazos por você.", tone: "orange" },
  { icon: Target, title: "Metas e portfólios", text: "Conecte projetos aos objetivos da equipe e acompanhe progresso, saúde e prazos em um só lugar.", tone: "green" },
  { icon: MessageSquare, title: "Colaboração no contexto", text: "Comentários, seguidores e uma caixa de entrada que mostra só o que precisa da sua atenção.", tone: "pink" },
  { icon: Command, title: "Rápido como um app nativo", text: "Busca global com ⌘K, atalhos de teclado e um aplicativo para Mac e Windows além da versão web.", tone: "graphite" },
];

const faqs = [
  { q: "O Orbitask é gratuito?", a: "Sim. Você cria a conta, o workspace e convida sua equipe sem cartão de crédito." },
  { q: "Preciso instalar alguma coisa?", a: "Não. O Orbitask funciona direto no navegador. Se preferir, o aplicativo Desktop para macOS e Windows oferece a mesma experiência com atalhos nativos." },
  { q: "Posso convidar pessoas de fora da empresa?", a: "Pode. Convidados acessam apenas os projetos que você liberar, enquanto membros veem todo o workspace." },
  { q: "Como meus dados são protegidos?", a: "Senhas são armazenadas com bcrypt, cada sessão usa um token próprio que você pode encerrar a qualquer momento, e o acesso é verificado em cada requisição." },
  { q: "Consigo recuperar uma tarefa excluída?", a: "Sim. Tarefas excluídas vão para a lixeira do projeto e podem ser restauradas — inclusive pelo botão “Desfazer” logo após a exclusão." },
];

export function LandingPage() {
  useReveal();
  const [view, setView] = useState<"board" | "list" | "calendar" | "timeline">("board");
  const viewInfo: Record<typeof view, { title: string; text: string }> = {
    board: { title: "Quadro", text: "Visualize o fluxo e mova o trabalho entre etapas com arrastar e soltar." },
    list: { title: "Lista", text: "Agrupe por status, prioridade ou responsável e ordene como quiser." },
    calendar: { title: "Calendário", text: "Veja prazos no mês e arraste tarefas para reagendar." },
    timeline: { title: "Cronograma", text: "Planeje início e fim de cada entrega e enxergue sobreposições." },
  };
  return (
    <div className="site">
      <Nav />
      <main>
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-copy">
            <a href="/novidades" className="hero-eyebrow">
              <span>Novo</span> Orbitask {VERSION}: visual renovado e Minhas tarefas <ArrowRight />
            </a>
            <h1>
              O trabalho da equipe,
              <br />
              <span className="gradient-text">em perfeita órbita.</span>
            </h1>
            <p>Planeje projetos, distribua tarefas e acompanhe metas em um espaço calmo e rápido — no navegador ou no seu computador.</p>
            <div className="hero-actions">
              <a href="/app?cadastro=1" className="site-button primary large">
                Começar grátis <ArrowRight />
              </a>
              <a href="/download" className="site-button large">
                <Download /> Baixar o app
              </a>
            </div>
            <small className="hero-note">Grátis para começar · Sem cartão de crédito · Pronto em 30 segundos</small>
          </div>
          <div className="hero-product" data-reveal>
            <ProductWindow />
          </div>
        </section>

        <section className="for-teams" data-reveal>
          <p>Feito para equipes de</p>
          <ul>
            <li>Produto</li>
            <li>Engenharia</li>
            <li>Marketing</li>
            <li>Agências</li>
            <li>Operações</li>
            <li>Educação</li>
          </ul>
        </section>

        <section id="recursos" className="section">
          <div className="section-head" data-reveal>
            <span className="kicker">Recursos</span>
            <h2>Tudo o que a equipe precisa. Nada que atrapalhe.</h2>
            <p>O Orbitask reúne o essencial da gestão de trabalho com uma interface que não grita. Você foca no que importa.</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className={`feature-card tone-${feature.tone}`} data-reveal>
                <span className="feature-icon">
                  <feature.icon />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="visualizacoes" className="section views-section">
          <div className="section-head" data-reveal>
            <span className="kicker">Visualizações</span>
            <h2>Cada pessoa vê do seu jeito.</h2>
            <p>Os mesmos dados, quatro perspectivas. Troque com um clique ou com as teclas 2 a 5.</p>
          </div>
          <div className="view-switch" role="tablist" aria-label="Exemplos de visualização" data-reveal>
            {(Object.keys(viewInfo) as (typeof view)[]).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
                {viewInfo[id].title}
              </button>
            ))}
          </div>
          <p className="view-caption">{viewInfo[view].text}</p>
          <div className="views-product" data-reveal>
            <ProductWindow view={view} />
          </div>
        </section>

        <section className="section split-section">
          <div className="split-copy" data-reveal>
            <span className="kicker">Painel da tarefa</span>
            <h2>Contexto completo, sem trocar de tela.</h2>
            <p>Abra qualquer tarefa e encontre status, responsáveis, datas, subtarefas, checklist, dependências, links e a conversa da equipe — tudo salvo automaticamente.</p>
            <ul className="check-bullets">
              <li>
                <Check /> Subtarefas e checklists com progresso
              </li>
              <li>
                <Check /> Dependências que avisam quando algo está bloqueado
              </li>
              <li>
                <Check /> Campos personalizados para o seu processo
              </li>
              <li>
                <Check /> Histórico de atividade e comentários
              </li>
            </ul>
          </div>
          <div className="task-mock" data-reveal aria-hidden="true">
            <div className="tm-head">
              <span className="tm-crumb">
                <i /> Lançamento do app
              </span>
              <span className="tm-done">
                <Check /> Concluir
              </span>
            </div>
            <h4>Novo fluxo de onboarding</h4>
            <dl>
              <dt>Status</dt>
              <dd>
                <span className="mock-pill" style={{ "--c": "#2f7ff0" } as React.CSSProperties}>
                  Em andamento
                </span>
              </dd>
              <dt>Responsáveis</dt>
              <dd>
                <MockAvatar initials="RC" /> Rafaela Costa
              </dd>
              <dt>Prazo</dt>
              <dd>
                <span className="mock-due today">Hoje</span>
              </dd>
              <dt>Tags</dt>
              <dd>
                <span className="mock-pill" style={{ "--c": "#d6409f" } as React.CSSProperties}>
                  Design
                </span>
                <span className="mock-pill" style={{ "--c": "#6559e8" } as React.CSSProperties}>
                  Produto
                </span>
              </dd>
            </dl>
            <div className="tm-section">
              <b>Checklist · 3/5</b>
              <div className="tm-progress">
                <span />
              </div>
              <p className="done">
                <Check /> Mapear etapas atuais
              </p>
              <p className="done">
                <Check /> Wireframes
              </p>
              <p className="done">
                <Check /> Teste com 5 usuários
              </p>
              <p>
                <i /> Ajustar textos
              </p>
            </div>
            <div className="tm-comment">
              <MockAvatar initials="AM" />
              <div>
                <b>Ana Martins</b>
                <p>Os testes mostraram que o passo 3 confunde. Sugiro juntar com o 2.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="section">
          <div className="section-head" data-reveal>
            <span className="kicker">Como funciona</span>
            <h2>Do cadastro ao primeiro projeto em minutos.</h2>
          </div>
          <ol className="steps">
            <li data-reveal>
              <span>1</span>
              <h3>Crie seu workspace</h3>
              <p>Cadastre-se e receba um workspace com o primeiro projeto e um fluxo pronto para usar.</p>
            </li>
            <li data-reveal>
              <span>2</span>
              <h3>Convide a equipe</h3>
              <p>Envie convites seguros e defina quem é administrador, membro ou convidado.</p>
            </li>
            <li data-reveal>
              <span>3</span>
              <h3>Organize e acompanhe</h3>
              <p>Distribua tarefas, automatize o repetitivo e acompanhe o progresso nos relatórios.</p>
            </li>
          </ol>
        </section>

        <section className="section platforms">
          <div className="platform-card" data-reveal>
            <Globe />
            <h3>Na web</h3>
            <p>Acesse de qualquer navegador moderno, sem instalar nada. Ideal para quem trabalha em vários computadores.</p>
            <a href="/app" className="text-link">
              Abrir o app web <ArrowRight />
            </a>
          </div>
          <div className="platform-card" data-reveal>
            <Laptop />
            <h3>No Desktop</h3>
            <p>Aplicativo para macOS e Windows com material nativo, atalhos do sistema e janela própria.</p>
            <a href="/download" className="text-link">
              Ver downloads <ArrowRight />
            </a>
          </div>
        </section>

        <section id="seguranca" className="section security" data-reveal>
          <div className="security-inner">
            <ShieldCheck className="security-icon" />
            <div>
              <h2>Segurança pensada desde o início.</h2>
              <p>Seu trabalho é importante. Por isso o Orbitask protege cada camada.</p>
            </div>
            <ul>
              <li>
                <KeyRound /> Senhas com hash bcrypt
              </li>
              <li>
                <Lock /> Sessões revogáveis a qualquer momento
              </li>
              <li>
                <Users /> Papéis e acesso restrito por projeto
              </li>
              <li>
                <Workflow /> Lixeira com restauração de tarefas
              </li>
            </ul>
          </div>
        </section>

        <section id="perguntas" className="section faq">
          <div className="section-head" data-reveal>
            <span className="kicker">Perguntas frequentes</span>
            <h2>Ficou alguma dúvida?</h2>
          </div>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.q} data-reveal>
                <summary>
                  {item.q}
                  <ChevronDown />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" data-reveal>
          <LogoMark size={56} />
          <h2>Coloque o trabalho em órbita hoje.</h2>
          <p>Crie seu workspace gratuitamente e convide a equipe em minutos.</p>
          <div className="hero-actions">
            <a href="/app?cadastro=1" className="site-button primary large">
              Criar conta grátis <ArrowRight />
            </a>
            <a href="/app" className="site-button large">
              Já tenho conta
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Download ---------- */

export function DownloadPage() {
  const isMac = /Mac/.test(navigator.userAgent);
  const cards = [
    { id: "mac", title: "Orbitask para macOS", detail: "Apple Silicon e Intel · macOS 12 ou superior", url: downloads.mac, primary: isMac },
    { id: "windows", title: "Orbitask para Windows", detail: "Windows 10 ou superior · 64 bits", url: downloads.windows, primary: !isMac },
  ];
  return (
    <div className="site">
      <Nav />
      <main className="page-main">
        <div className="page-hero">
          <span className="kicker">Orbitask Desktop</span>
          <h1>Seu trabalho, a um clique do Dock.</h1>
          <p>A mesma experiência da web, com janela própria, material nativo do sistema e atalhos de teclado.</p>
        </div>
        <div className="download-grid">
          {cards.map((card) => (
            <article key={card.id} className={`download-card ${card.primary ? "recommended" : ""}`}>
              {card.primary && <span className="download-badge">Recomendado para você</span>}
              <span className="download-os">{card.id === "mac" ? <Laptop /> : <Monitor />}</span>
              <h2>{card.title}</h2>
              <p>{card.detail}</p>
              {card.url ? (
                <a href={card.url} className="site-button primary">
                  <Download /> Baixar versão {VERSION}
                </a>
              ) : (
                <>
                  <span className="site-button disabled" aria-disabled="true">
                    <Download /> Disponível em breve
                  </span>
                  <small>Enquanto isso, use o <a href="/app">app web</a> — é a mesma conta.</small>
                </>
              )}
            </article>
          ))}
        </div>
        <div className="release-strip">
          <div>
            <span className="kicker">Versão mais recente</span>
            <h3>Orbitask {VERSION}</h3>
            <p>Visual renovado, Minhas tarefas, ajustes de conta e segurança, lixeira e muito mais.</p>
          </div>
          <a href="/novidades" className="text-link">
            Ver notas da versão <ArrowRight />
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ---------- Novidades ---------- */

const releases = [
  {
    version: "0.4.0",
    date: "8 out 2026",
    title: "Uma experiência completamente renovada",
    text: "Redesenhamos o Orbitask do zero para ser mais calmo, claro e rápido — com a mesma interface na web e no Desktop.",
    items: [
      "Novo visual com tema claro e escuro, cores de destaque e material translúcido",
      "Início com seu foco do dia e Minhas tarefas em todos os projetos",
      "Ajustes de perfil, troca de senha e encerramento de outras sessões",
      "Renomear o workspace, excluir projetos e lixeira com restauração",
      "Paleta de comandos (⌘K), atalhos de teclado e navegação pelo endereço",
      "Calendário com arrastar para reagendar e cronograma com barra de hoje",
    ],
  },
  {
    version: "0.3.0",
    date: "24 set 2026",
    title: "Da execução à estratégia",
    text: "O Orbitask passou a cobrir o fluxo completo de trabalho em equipe.",
    items: ["Colaboração com membros, convidados, comentários e notificações", "Subtarefas, checklists, dependências e campos personalizados", "Automações, dashboard, portfólios e metas"],
  },
  {
    version: "0.1.0",
    date: "26 ago 2026",
    title: "A fundação está pronta",
    text: "Primeira versão com projetos, tarefas e as visualizações essenciais.",
    items: [],
  },
];

export function ReleasesPage() {
  return (
    <div className="site">
      <Nav />
      <main className="page-main">
        <div className="page-hero">
          <span className="kicker">Novidades</span>
          <h1>O Orbitask melhora a cada versão.</h1>
          <p>Novos recursos, melhorias e correções — em ordem cronológica.</p>
        </div>
        <div className="release-list">
          {releases.map((release) => (
            <article key={release.version} className="release">
              <aside>
                <time>{release.date}</time>
                <span className="release-version">v{release.version}</span>
              </aside>
              <div>
                <h2>{release.title}</h2>
                <p>{release.text}</p>
                {release.items.length > 0 && (
                  <ul className="check-bullets">
                    {release.items.map((item) => (
                      <li key={item}>
                        <Check /> {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

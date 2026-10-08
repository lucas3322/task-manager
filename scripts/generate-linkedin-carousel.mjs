import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputDir = path.resolve('marketing/linkedin');
await mkdir(outputDir, { recursive: true });

const purple = '#6559E8';
const dark = '#20202B';
const muted = '#707080';

const logo = (x, y, size = 72, darkBg = false) => `
  <g transform="translate(${x} ${y})">
    <rect width="${size}" height="${size}" rx="${size * 0.28}" fill="${darkBg ? '#FFFFFF' : purple}"/>
    <path d="M${size * .5} ${size * .18}c2 12 8 18 20 20-12 2-18 8-20 20-2-12-8-18-20-20 12-2 18-8 20-20Z" fill="${darkBg ? purple : '#FFFFFF'}"/>
    <circle cx="${size * .25}" cy="${size * .25}" r="${size * .035}" fill="${darkBg ? purple : '#FFFFFF'}"/>
    <circle cx="${size * .76}" cy="${size * .67}" r="${size * .028}" fill="${darkBg ? purple : '#FFFFFF'}"/>
  </g>`;

const base = (body, { darkBg = false } = {}) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="soft" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#F0EEFF"/></linearGradient>
    <linearGradient id="deep" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#3D2EB2"/><stop offset=".55" stop-color="#6559E8"/><stop offset="1" stop-color="#877EFF"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#2F255C" flood-opacity=".14"/></filter>
    <style>
      text{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif}
      .eyebrow{font-size:23px;font-weight:700;letter-spacing:2px}
      .title{font-size:70px;font-weight:800;letter-spacing:-3px;fill:${darkBg ? '#FFFFFF' : dark}}
      .subtitle{font-size:31px;font-weight:450;fill:${darkBg ? '#E8E5FF' : muted}}
      .label{font-size:25px;font-weight:700;fill:${dark}}
      .small{font-size:20px;fill:${muted}}
    </style>
  </defs>
  ${body}
</svg>`;

const slides = [
  base(`
    <rect width="1200" height="1200" fill="url(#soft)"/>
    <circle cx="1020" cy="170" r="230" fill="none" stroke="#DDD8FF" stroke-width="2"/>
    <circle cx="1020" cy="170" r="160" fill="none" stroke="#E8E5FF" stroke-width="2"/>
    ${logo(82, 74, 64)}
    <text x="164" y="118" class="label">orbitask</text>
    <text x="82" y="276" class="eyebrow" fill="${purple}">NOVA PLATAFORMA DE PRODUTIVIDADE</text>
    <text x="82" y="386" class="title">Conheça o</text>
    <text x="82" y="468" class="title" fill="${purple}">Orbitask.</text>
    <text x="82" y="535" class="subtitle">Organize o trabalho.</text>
    <text x="82" y="575" class="subtitle">Ganhe clareza.</text>
    <g filter="url(#shadow)">
      <rect x="82" y="675" width="1036" height="405" rx="36" fill="#FFFFFF"/>
      <rect x="82" y="675" width="238" height="405" rx="36" fill="#171725"/>
      <rect x="112" y="728" width="178" height="48" rx="12" fill="${purple}"/>
      <text x="149" y="759" font-size="18" font-weight="700" fill="#FFF">＋ Criar</text>
      <text x="116" y="837" font-size="18" fill="#D4D0E8">⌂  Visão geral</text>
      <text x="116" y="890" font-size="18" fill="#D4D0E8">✓  Minhas tarefas</text>
      <text x="354" y="742" class="small">PROJETOS  /  PRODUTO</text>
      <text x="354" y="792" font-size="30" font-weight="750" fill="${dark}">Lançamento do produto</text>
      <rect x="354" y="838" width="212" height="180" rx="18" fill="#F7F6FB" stroke="#E8E6F0"/>
      <rect x="586" y="838" width="212" height="180" rx="18" fill="#F7F6FB" stroke="#E8E6F0"/>
      <rect x="818" y="838" width="250" height="180" rx="18" fill="#F7F6FB" stroke="#E8E6F0"/>
      <rect x="378" y="884" width="164" height="86" rx="14" fill="#FFF" stroke="#E8E6F0"/>
      <rect x="610" y="884" width="164" height="86" rx="14" fill="#FFF" stroke="#E8E6F0"/>
      <rect x="842" y="884" width="202" height="86" rx="14" fill="#FFF" stroke="#E8E6F0"/>
      <circle cx="398" cy="864" r="6" fill="#A8A4B6"/><circle cx="630" cy="864" r="6" fill="${purple}"/><circle cx="862" cy="864" r="6" fill="#2CA97B"/>
    </g>`),
  base(`
    <rect width="1200" height="1200" fill="#FAFAFD"/>
    ${logo(82, 74, 64)}<text x="164" y="118" class="label">orbitask</text>
    <text x="82" y="276" class="eyebrow" fill="${purple}">UM ÚNICO LUGAR</text>
    <text x="82" y="378" class="title">Menos ferramentas.</text>
    <text x="82" y="460" class="title" fill="${purple}">Mais clareza.</text>
    <text x="82" y="529" class="subtitle">Projetos, tarefas e processos em um só lugar.</text>
    <g opacity=".52">
      <rect x="80" y="674" width="210" height="112" rx="22" fill="#FFF" stroke="#D8D6E2"/><text x="112" y="738" class="label">Tarefas</text>
      <rect x="126" y="914" width="230" height="112" rx="22" fill="#FFF" stroke="#D8D6E2"/><text x="158" y="978" class="label">Prazos</text>
      <rect x="844" y="680" width="260" height="112" rx="22" fill="#FFF" stroke="#D8D6E2"/><text x="876" y="744" class="label">Comentários</text>
      <rect x="866" y="920" width="238" height="112" rx="22" fill="#FFF" stroke="#D8D6E2"/><text x="898" y="984" class="label">Anexos</text>
    </g>
    <path d="M290 730C420 750 420 825 492 844M356 970C430 950 438 884 492 858M844 736C750 760 752 820 708 844M866 976C780 944 772 886 708 860" fill="none" stroke="#B8B1FF" stroke-width="7" stroke-linecap="round"/>
    <g filter="url(#shadow)"><rect x="474" y="710" width="252" height="290" rx="40" fill="${purple}"/>${logo(554, 770, 92, true)}<text x="537" y="916" font-size="32" font-weight="800" fill="#FFF">Orbitask</text><text x="522" y="950" font-size="18" fill="#E5E2FF">Tudo conectado</text></g>`),
  base(`
    <rect width="1200" height="1200" fill="url(#soft)"/>
    ${logo(82, 74, 64)}<text x="164" y="118" class="label">orbitask</text>
    <text x="82" y="260" class="eyebrow" fill="${purple}">FLUXOS FLEXÍVEIS</text>
    <text x="82" y="358" class="title">Do plano à entrega.</text>
    <text x="82" y="426" class="subtitle">Kanban, lista, calendário e cronograma.</text>
    <g filter="url(#shadow)"><rect x="66" y="560" width="1068" height="530" rx="36" fill="#FFF"/>
      <g><rect x="100" y="604" width="226" height="432" rx="22" fill="#F6F5FA"/><circle cx="126" cy="643" r="7" fill="#A4A1AE"/><text x="145" y="651" class="label">A fazer</text><rect x="120" y="700" width="186" height="110" rx="16" fill="#FFF" stroke="#E4E2EC"/><rect x="120" y="830" width="186" height="110" rx="16" fill="#FFF" stroke="#E4E2EC"/></g>
      <g><rect x="358" y="604" width="226" height="432" rx="22" fill="#F2F0FF"/><circle cx="384" cy="643" r="7" fill="${purple}"/><text x="403" y="651" class="label">Em andamento</text><rect x="378" y="700" width="186" height="110" rx="16" fill="#FFF" stroke="#D9D4FF"/></g>
      <g><rect x="616" y="604" width="226" height="432" rx="22" fill="#FFF8EE"/><circle cx="642" cy="643" r="7" fill="#F0A139"/><text x="661" y="651" class="label">Revisão</text></g>
      <g><rect x="874" y="604" width="226" height="432" rx="22" fill="#EFFAF6"/><circle cx="900" cy="643" r="7" fill="#2CA97B"/><text x="919" y="651" class="label">Concluído</text><rect x="894" y="830" width="186" height="110" rx="16" fill="#FFF" stroke="#D7EEE6"/></g>
      <path d="M470 810C560 910 710 920 934 842" fill="none" stroke="${purple}" stroke-width="7" stroke-linecap="round" stroke-dasharray="12 18"/><path d="M920 830l25 10-18 20" fill="none" stroke="${purple}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`),
  base(`
    <rect width="1200" height="1200" fill="#FAFAFD"/>
    ${logo(82, 74, 64)}<text x="164" y="118" class="label">orbitask</text>
    <text x="82" y="260" class="eyebrow" fill="${purple}">WEB + DESKTOP</text>
    <text x="82" y="358" class="title">O trabalho</text><text x="82" y="440" class="title" fill="${purple}">acompanha você.</text>
    <text x="82" y="506" class="subtitle">Projetos e preferências sempre sincronizados.</text>
    <circle cx="590" cy="840" r="244" fill="#F0EEFF"/>
    <path d="M398 856C520 730 682 724 814 842" fill="none" stroke="#B7B0FF" stroke-width="8" stroke-dasharray="8 18" stroke-linecap="round"/>
    <g filter="url(#shadow)"><rect x="136" y="650" width="470" height="320" rx="28" fill="#FFF" stroke="#E3E1EC"/><rect x="162" y="682" width="418" height="236" rx="12" fill="#F7F6FB"/><rect x="162" y="682" width="102" height="236" rx="12" fill="#1A1927"/><rect x="284" y="722" width="258" height="28" rx="10" fill="#E7E4F8"/><rect x="284" y="786" width="118" height="90" rx="14" fill="#FFF" stroke="#E2DFEB"/><rect x="420" y="786" width="122" height="90" rx="14" fill="#FFF" stroke="#E2DFEB"/><path d="M108 988h526l-44 44H152Z" fill="#DCD9E6"/></g>
    <g filter="url(#shadow)"><rect x="710" y="620" width="354" height="410" rx="34" fill="#1A1927"/><circle cx="887" cy="647" r="7" fill="#393747"/><rect x="736" y="677" width="302" height="318" rx="16" fill="#FFF"/><rect x="762" y="716" width="250" height="32" rx="10" fill="#E9E6FA"/><rect x="762" y="783" width="110" height="116" rx="14" fill="#F5F4F9"/><rect x="888" y="783" width="124" height="116" rx="14" fill="#F5F4F9"/></g>
    <g><circle cx="634" cy="742" r="38" fill="${purple}"/><path d="M617 742l12 12 24-28" fill="none" stroke="#FFF" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>`),
  base(`
    <rect width="1200" height="1200" fill="url(#deep)"/>
    <circle cx="600" cy="600" r="430" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="2"/>
    <circle cx="600" cy="600" r="320" fill="none" stroke="#FFFFFF" stroke-opacity=".1" stroke-width="2"/>
    <circle cx="600" cy="600" r="220" fill="none" stroke="#FFFFFF" stroke-opacity=".12" stroke-width="2"/>
    ${logo(552, 138, 96, true)}
    <text x="600" y="350" text-anchor="middle" class="eyebrow" fill="#DCD8FF">COMECE EM MINUTOS</text>
    <text x="600" y="468" text-anchor="middle" class="title">Seu próximo projeto</text>
    <text x="600" y="550" text-anchor="middle" class="title">começa com mais</text>
    <text x="600" y="632" text-anchor="middle" class="title">clareza.</text>
    <rect x="382" y="728" width="436" height="92" rx="24" fill="#FFF" filter="url(#shadow)"/>
    <text x="600" y="786" text-anchor="middle" font-size="29" font-weight="800" fill="${purple}">Experimente o Orbitask  →</text>
    <text x="600" y="918" text-anchor="middle" font-size="24" fill="#E7E4FF">Web e Desktop • Projetos • Tarefas • Equipes</text>
    <text x="600" y="1070" text-anchor="middle" font-size="25" font-weight="750" fill="#FFF">✦ orbitask</text>`, { darkBg: true }),
];

for (const [index, slide] of slides.entries()) {
  await writeFile(path.join(outputDir, `orbitask-linkedin-${index + 1}.svg`), slide);
}

console.log(`Generated ${slides.length} slides in ${outputDir}`);

export type PrintDoc = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  meta?: string[];
  columns?: string[];
  rows?: string[][];
  emptyMessage?: string;
  sections?: Array<{ heading: string; columns: string[]; rows: string[][]; emptyMessage?: string }>;
  footer?: string;
};

const BRAND_NAME = 'Smart Campus';
const BRAND_TAGLINE = 'UJAC · Academia viva';
const BRAND_MARK = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M6 22 L16 8 L26 22 Z" stroke="currentColor" stroke-width="1.8" />
  <path d="M10 22 H22" stroke="currentColor" stroke-width="1.8" />
  <circle cx="16" cy="16.5" r="2" fill="currentColor" />
</svg>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTable(columns: string[], rows: string[][], emptyMessage?: string): string {
  const head = columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body =
    rows.length > 0
      ? rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
          .join('')
      : `<tr><td class="empty" colspan="${columns.length}">${escapeHtml(emptyMessage ?? 'Sem dados para apresentar.')}</td></tr>`;
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildHtml(doc: PrintDoc): string {
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(now);
  const timeLabel = new Intl.DateTimeFormat('pt-PT', { timeStyle: 'short' }).format(now);
  const metaHtml = (doc.meta ?? []).filter(Boolean).map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join('');
  const mainTable = doc.columns ? renderTable(doc.columns, doc.rows ?? [], doc.emptyMessage) : '';
  const sectionsHtml = (doc.sections ?? [])
    .map(
      (section) =>
        `<section class="block"><h2>${escapeHtml(section.heading)}</h2>${renderTable(
          section.columns,
          section.rows,
          section.emptyMessage,
        )}</section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(doc.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #10233d;
    --deep: #1a3a5c;
    --teal: #1a6b5c;
    --teal-dark: #0f4f44;
    --sage: #5f7f72;
    --brass: #8a6a3d;
    --mist: #f4f7fa;
    --paper: #fbfcfd;
    --line: #d0dbe6;
  }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0;
    font-family: 'Manrope', 'Segoe UI', sans-serif;
    color: var(--ink);
    font-size: 12.5px;
    line-height: 1.45;
    background: #fff;
  }
  .page { padding: 26px 30px 40px; }
  .brandbar { height: 6px; border-radius: 999px; background: linear-gradient(90deg, var(--ink), #123049 42%, var(--teal-dark)); }
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 0 12px;
    border-bottom: 1px solid var(--line);
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark {
    display: grid;
    place-items: center;
    width: 46px; height: 46px;
    border-radius: 13px;
    color: #fff;
    background: linear-gradient(135deg, var(--teal), var(--teal-dark));
    box-shadow: 0 6px 16px rgba(16, 35, 61, 0.14);
  }
  .mark svg { width: 26px; height: 26px; }
  .brand-name { margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 21px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
  .brand-tag { margin: 2px 0 0; font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sage); font-weight: 600; }
  .stamp { text-align: right; font-size: 10.5px; color: var(--sage); }
  .stamp strong { display: block; color: var(--deep); font-size: 11px; letter-spacing: 0.04em; }
  .eyebrow { margin: 18px 0 4px; font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--teal); }
  h1 { margin: 0; font-family: 'Fraunces', Georgia, serif; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
  .subtitle { margin: 6px 0 0; color: var(--deep); font-size: 13px; }
  .meta { margin: 3px 0 0; color: var(--sage); font-size: 11px; }
  .meta-row { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 8px; }
  .meta-row .meta { margin: 0; }
  .meters { margin: 14px 0 4px; }
  .block { margin-top: 18px; }
  h2 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--deep); }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; overflow: hidden; border-radius: 10px; }
  th, td { border: 1px solid var(--line); padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: var(--mist); color: var(--deep); font-weight: 700; font-size: 11px; letter-spacing: 0.02em; }
  tbody tr:nth-child(even) { background: var(--paper); }
  .empty { text-align: center; color: var(--sage); font-style: italic; }
   .signature { margin-top: 64px; display: flex; justify-content: space-between; gap: 32px; }
   .signature span { flex: 1; border-top: 1px solid var(--deep); padding-top: 8px; font-size: 10px; color: var(--deep); text-align: center; line-height: 1.6; }
  .doc-footer {
    margin-top: 34px;
    padding-top: 10px;
    border-top: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 9.5px;
    letter-spacing: 0.04em;
    color: var(--sage);
  }
  @page { size: A4; margin: 12mm; }
  @media print { .page { padding: 0; } }
</style>
</head>
<body>
  <div class="page">
    <div class="brandbar"></div>
    <header class="doc-header">
      <div class="brand">
        <div class="mark">${BRAND_MARK}</div>
        <div>
          <p class="brand-name">${escapeHtml(BRAND_NAME)}</p>
          <p class="brand-tag">${escapeHtml(BRAND_TAGLINE)}</p>
        </div>
      </div>
      <div class="stamp">
        <strong>Documento oficial</strong>
        ${escapeHtml(dateLabel)}<br />${escapeHtml(timeLabel)}
      </div>
    </header>

    <p class="eyebrow">${escapeHtml(doc.eyebrow ?? 'Grupo Académico')}</p>
    <h1>${escapeHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ''}
    ${metaHtml ? `<div class="meta-row">${metaHtml}</div>` : ''}

    <div class="meters">${mainTable}</div>
    ${sectionsHtml}

    <div class="signature">
      ${doc.footer ? `<span>${escapeHtml(doc.footer)}</span>` : `<span>Docente ___________________________   Assinatura e Carimbo</span>`}
      <span>Coordenação / Secretariado ___________________________   Assinatura e Carimbo</span>
    </div>

    <footer class="doc-footer">
      <span>${escapeHtml(BRAND_NAME)} · ${escapeHtml(BRAND_TAGLINE)}</span>
      <span>Documento gerado automaticamente pela plataforma Smart Campus</span>
    </footer>
  </div>
  <script>
    (function () {
      var printed = false;
      function go() {
        if (printed) return;
        printed = true;
        try { window.focus(); } catch (e) {}
        window.print();
      }
      try {
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
          document.fonts.ready.then(go);
        }
      } catch (e) {}
      setTimeout(go, 1200);
    })();
  </script>
</body>
</html>`;
}

export function printDocument(doc: PrintDoc): void {
  const html = buildHtml(doc);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', doc.title);
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onafterprint = cleanup;
  // Fallback: remove o iframe mesmo que onafterprint não dispare (ex.: cancelar).
  setTimeout(cleanup, 60_000);
}

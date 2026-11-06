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
  orientation?: 'portrait' | 'landscape';
  signatures?: string[];
  summary?: Array<{ label: string; value: string }>;
};

const BRAND_NAME = 'Smart Campus';
const BRAND_TAGLINE = 'Sistema Integrado de Gestão Universitária';
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
  const head = columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');
  const body =
    rows.length > 0
      ? rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
          .join('')
      : `<tr><td class="empty" colspan="${columns.length}">${escapeHtml(emptyMessage ?? 'Sem dados para apresentar.')}</td></tr>`;
  const columnWidths = columns[0] === 'Estudante / Nº'
    ? `<colgroup><col style="width:24%" />${columns.slice(1).map(() => '<col />').join('')}</colgroup>`
    : '';
  return `<table>${columnWidths}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildPrintHtml(doc: PrintDoc): string {
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(now);
  const timeLabel = new Intl.DateTimeFormat('pt-PT', { timeStyle: 'short' }).format(now);
  const metaHtml = (doc.meta ?? []).filter(Boolean).map((line) => {
    const separator = line.indexOf(':');
    return separator > 0
      ? `<div class="meta"><span>${escapeHtml(line.slice(0, separator))}</span><strong>${escapeHtml(line.slice(separator + 1).trim())}</strong></div>`
      : `<div class="meta"><strong>${escapeHtml(line)}</strong></div>`;
  }).join('');
  const maxColumns = Math.max(doc.columns?.length ?? 0, ...(doc.sections ?? []).map((section) => section.columns.length));
  const orientation = doc.orientation ?? (maxColumns >= 6 ? 'landscape' : 'portrait');
  const summaryHtml = (doc.summary ?? []).map((item) => `<div class="summary-item"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('');
  const signaturesHtml = (doc.signatures ?? []).map((label) => `<div class="signature-line">${escapeHtml(label)}<small>Assinatura e carimbo</small></div>`).join('');
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
<style>
  :root { --ink: #173247; --muted: #596c79; --accent: #17655e; --line: #d5dfe4; --wash: #f2f6f7; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e9eef1; color: var(--ink); font: 10pt/1.5 Arial, 'Segoe UI', sans-serif; }
  .page { max-width: ${orientation === 'landscape' ? '297' : '210'}mm; margin: 24px auto; padding: 14mm; background: white; box-shadow: 0 8px 32px #17324718; }
  .brandbar { height: 4px; background: var(--accent); }
  .doc-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 18px 0; border-bottom: 1px solid var(--line); }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--accent); border-radius: 10px; color: var(--accent); }
  .mark svg { width: 28px; height: 28px; }
  .brand-name { margin: 0; font: bold 20pt Georgia, serif; letter-spacing: -.4px; }
  .brand-tag { margin: 2px 0 0; font-size: 7.5pt; color: var(--muted); }
  .stamp { text-align: right; font-size: 8pt; color: var(--muted); white-space: nowrap; }
  .stamp strong { display: block; margin-bottom: 3px; font-size: 8pt; color: var(--ink); }
  .eyebrow { margin: 22px 0 5px; color: var(--accent); font-size: 8pt; font-weight: bold; letter-spacing: 1.1px; text-transform: uppercase; }
  h1 { margin: 0; font: bold 21pt/1.25 Georgia, serif; overflow-wrap: anywhere; }
  .subtitle { margin: 7px 0 0; font-size: 11pt; color: var(--muted); }
  .meta-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; padding: 15px 18px; margin-top: 18px; border: 1px solid var(--line); border-radius: 8px; background: var(--wash); }
  .meta { min-width: 0; overflow-wrap: anywhere; }
  .meta span, .summary-item span { display: block; color: var(--muted); font-size: 7.5pt; }
  .meta strong { display: block; margin-top: 2px; font-size: 9pt; font-weight: 600; }
  .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
  .summary-item { flex: 1; min-width: 100px; border-left: 3px solid var(--accent); background: var(--wash); padding: 10px 14px; }
  .summary-item strong { display: block; margin-top: 3px; font-size: 15pt; font-variant-numeric: tabular-nums; }
  .meters, .block { margin-top: 22px; }
  h2 { margin: 0 0 9px; font-size: 11pt; color: var(--ink); break-after: avoid; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: ${maxColumns > 9 ? '8' : '9'}pt; }
  th, td { padding: 8px 9px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; overflow-wrap: anywhere; white-space: pre-line; font-variant-numeric: tabular-nums; }
  th { border-top: 1px solid var(--line); background: var(--wash); color: var(--ink); font-size: 8pt; font-weight: bold; }
  tbody tr:nth-child(even) { background: #f8fafb; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .empty { padding: 24px; text-align: center; color: var(--muted); }
  .document-note { margin: 18px 0 0; padding: 10px 12px; border-left: 2px solid var(--line); font-size: 8pt; color: var(--muted); white-space: pre-line; break-inside: avoid; }
  .signature { margin-top: 55px; display: flex; justify-content: space-around; gap: 40px; break-inside: avoid; page-break-inside: avoid; }
  .signature-line { flex: 1; max-width: 240px; border-top: 1px solid var(--ink); padding-top: 8px; text-align: center; font-size: 9pt; }
  .signature-line small { display: block; margin-top: 3px; font-size: 7pt; color: var(--muted); }
  .doc-footer { margin-top: 28px; border-top: 1px solid var(--line); padding-top: 9px; display: flex; justify-content: space-between; gap: 20px; font-size: 7pt; color: var(--muted); break-inside: avoid; }
  @page {
    size: A4 ${orientation}; margin: 14mm 12mm 17mm;
    @bottom-left { content: "Smart Campus · Documento gerado pela plataforma"; font: 7pt Arial, sans-serif; color: #596c79; }
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7pt Arial, sans-serif; color: #596c79; }
  }
  @media print {
    body { background: white; }
    .page { max-width: none; margin: 0; padding: 0; box-shadow: none; }
    .doc-header, .meta-row, .summary { break-inside: avoid; page-break-inside: avoid; }
    .eyebrow, h1, .subtitle { break-after: avoid; }
  }
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
        <strong>Emitido pela plataforma</strong>
        ${escapeHtml(dateLabel)}<br />${escapeHtml(timeLabel)}
      </div>
    </header>

    <p class="eyebrow">${escapeHtml(doc.eyebrow ?? 'Grupo Académico')}</p>
    <h1>${escapeHtml(doc.title)}</h1>
    ${doc.subtitle ? `<p class="subtitle">${escapeHtml(doc.subtitle)}</p>` : ''}
    ${metaHtml ? `<div class="meta-row">${metaHtml}</div>` : ''}

    ${summaryHtml ? `<div class="summary">${summaryHtml}</div>` : ''}
    ${mainTable ? `<div class="meters">${mainTable}</div>` : ''}
    ${sectionsHtml}

    ${doc.footer ? `<p class="document-note">${escapeHtml(doc.footer)}</p>` : ''}
    ${signaturesHtml ? `<div class="signature">${signaturesHtml}</div>` : ''}

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
  const html = buildPrintHtml(doc);
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

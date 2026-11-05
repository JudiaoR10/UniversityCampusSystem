export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Array<Array<string | number>>) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '');
          return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(';'),
    )
    .join('\n');
}

export function toSimplePdf(title: string, lines: string[]) {
  const escaped = [title, '', ...lines]
    .join('\n')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
  const text = escaped
    .split('\n')
    .map((line, index) => (index === 0 ? `(${line}) Tj` : `T* (${line}) Tj`))
    .join('\n');
  const stream = `BT /F1 12 Tf 48 800 Td 14 TL\n${text}\nET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];
  let offset = 9;
  const xref = ['0000000000 65535 f '];
  const body = objects
    .map((object) => {
      const line = `${object}\n`;
      xref.push(`${String(offset).padStart(10, '0')} 00000 n `);
      offset += line.length;
      return line;
    })
    .join('');
  return `%PDF-1.4\n${body}xref\n0 6\n${xref.join('\n')}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
}

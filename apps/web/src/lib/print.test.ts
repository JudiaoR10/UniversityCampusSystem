import { describe, expect, it } from 'vitest';
import { buildPrintHtml } from './print';

describe('Documentos para impressão', () => {
  it('protege todos os campos dinâmicos contra HTML e preserva os dados', () => {
    const html = buildPrintHtml({
      title: '<script>teste</script>', subtitle: 'Ana & Rui',
      meta: ['Curso: <Informática>'], columns: ['Nome'], rows: [['<img src=x onerror=alert(1)>']],
      summary: [{ label: '<Valor>', value: '100 & 200' }], signatures: ['<Tesouraria>'], footer: '<Nota>',
      sections: [{ heading: '<Secção>', columns: ['<Coluna>'], rows: [['<Dado>']] }],
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('h1')?.textContent).toBe('<script>teste</script>');
    expect(doc.querySelector('img')).toBeNull();
    expect(doc.querySelector('.meta strong')?.textContent).toBe('<Informática>');
    expect(doc.querySelector('.summary-item strong')?.textContent).toBe('100 & 200');
    expect(doc.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(doc.querySelector('.document-note')?.textContent).toBe('<Nota>');
  });

  it('mantém todas as linhas e usa paisagem nas tabelas largas sem depender de fontes externas', () => {
    const html = buildPrintHtml({
      title: 'Pauta', columns: ['Nº', 'Nome', '01/11', '02/11', '03/11', '04/11'],
      rows: Array.from({ length: 125 }, (_, index) => [String(index), `Estudante ${index}`, 'P', 'F', 'J', 'P']),
    });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelectorAll('tbody tr')).toHaveLength(125);
    expect(doc.querySelectorAll('link')).toHaveLength(0);
    expect(html).toContain('size: A4 landscape');
    expect(html).toContain('display: table-header-group');
    expect(html).toContain('counter(page)');
  });

  it('usa retrato em recibos e só inclui as assinaturas pedidas', () => {
    const html = buildPrintHtml({ title: 'Recibo', columns: ['Campo', 'Valor'], rows: [['Valor', '100 MZN']], signatures: ['Tesouraria'] });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(html).toContain('size: A4 portrait');
    expect(doc.querySelectorAll('.signature-line')).toHaveLength(1);
    expect(doc.querySelector('.signature-line')?.textContent).toContain('Tesouraria');
    expect(html).not.toContain('Docente');
  });
});

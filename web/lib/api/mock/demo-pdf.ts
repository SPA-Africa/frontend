// A one-page PDF built in the browser, so the judge's document viewer has an anonymised copy to show
// in mock mode. Plain Helvetica text only, like the copies the backend renders.

export interface PdfLine { text: string; size?: number; bold?: boolean; gapAfter?: number }

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;

// Only printable ASCII, so string length equals byte length for the cross-reference offsets
const escape = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, m => `\\${m}`);

function wrap(text: string, size: number): string[] {
  const max = Math.floor((PAGE_W - 2 * MARGIN) / (size * 0.52));
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > max) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export function demoPdf(content: PdfLine[]): Blob {
  const ops: string[] = [];
  let y = PAGE_H - MARGIN;
  for (const l of content) {
    const size = l.size ?? 10.5;
    for (const part of wrap(l.text, size)) {
      y -= size * 1.45;
      if (y < MARGIN) break;
      ops.push(`BT /${l.bold ? 'F2' : 'F1'} ${size} Tf ${MARGIN} ${y.toFixed(1)} Td (${escape(part)}) Tj ET`);
    }
    y -= l.gapAfter ?? size * 0.6;
  }
  const stream = ops.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}

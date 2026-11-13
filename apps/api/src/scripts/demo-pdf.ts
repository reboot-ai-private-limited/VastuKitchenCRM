/** A tiny, dependency-free PDF writer: a title and lines of text on A4 pages (Helvetica). */
const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '-');

export function buildPdf(title: string, lines: string[]): Buffer {
  const perPage = 44;
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) pages.push(lines.slice(i, i + perPage));
  const objs: string[] = [];
  const add = (s: string) => objs.push(s) && objs.length;
  const catalog = add('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const kids: number[] = [];
  pages.forEach((pg, n) => {
    let y = 800;
    let s = n === 0 ? `BT /F2 18 Tf 50 ${y} Td (${esc(title)}) Tj ET\n` : '';
    y = n === 0 ? 770 : 800;
    for (const l of pg) {
      s += `BT /F1 11 Tf 50 ${y} Td (${esc(l)}) Tj ET\n`;
      y -= 16;
    }
    s += `BT /F1 8 Tf 50 30 Td (Vaastu Kitchen - page ${n + 1} of ${pages.length}) Tj ET\n`;
    const content = add(`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}endstream`);
    kids.push(
      add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Contents ${content} 0 R /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> >>`),
    );
  });
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

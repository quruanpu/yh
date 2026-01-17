// 文件模块 - PDF/Excel/CSV解析

// 读取PDF
export async function readPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text || '[PDF无法解析]';
  } catch (e) {
    return '[PDF解析失败]';
  }
}

// 读取Excel
export async function readExcel(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let result = '';
    workbook.SheetNames.forEach((sheetName, index) => {
      if (index > 2) return;
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (data.length === 0) return;
      result += `【工作表：${sheetName}】\n`;
      const maxRows = Math.min(data.length, 100);
      for (let i = 0; i < maxRows; i++) {
        const row = data[i];
        if (row && row.length > 0) result += row.join('\t') + '\n';
      }
      if (data.length > maxRows) result += `...共 ${data.length} 行，已截取前 ${maxRows} 行\n`;
      result += '\n';
    });
    return result || '[Excel无数据]';
  } catch (e) {
    return '[Excel解析失败]';
  }
}

// 读取CSV
export async function readCSV(file) {
  try {
    const text = await file.text();
    const lines = text.split('\n');
    const maxRows = Math.min(lines.length, 100);
    let result = lines.slice(0, maxRows).join('\n');
    if (lines.length > maxRows) result += `\n...共 ${lines.length} 行，已截取前 ${maxRows} 行`;
    return result;
  } catch (e) {
    return '[CSV解析失败]';
  }
}

// 统一读取文件内容
export async function readFileContent(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.type === 'application/pdf' || ext === 'pdf') return await readPDF(file);
  if (ext === 'xlsx' || ext === 'xls') return await readExcel(file);
  if (ext === 'csv') return await readCSV(file);
  return await file.text();
}

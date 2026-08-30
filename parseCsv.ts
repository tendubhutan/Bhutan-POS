export const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Basic CSV parse (no quoted comma support for simplicity, or we can use a small regex)
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ? values[i].trim() : '';
    });
    return obj;
  });
};

export function parseHeaders(headerString) {
  const headers = {};
  const lines = headerString.split("\r\n");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.substring(0, colonIndex).trim().toLowerCase();
      const value = line.substring(colonIndex + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
}

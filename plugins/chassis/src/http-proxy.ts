const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export function proxyHeaders<T extends string | string[]>(
  headers: Record<string, T | undefined>,
  extra: Iterable<string> = [],
): Record<string, T> {
  const excluded = new Set([...HOP_BY_HOP_HEADERS, ...[...extra].map((header) => header.toLowerCase())]);
  const connection = Object.entries(headers).find(([header]) => header.toLowerCase() === "connection")?.[1];
  let connectionList = "";
  if (typeof connection === "string") connectionList = connection;
  else if (Array.isArray(connection)) connectionList = connection.join(",");
  for (const header of connectionList.split(",")) {
    if (header.trim()) excluded.add(header.trim().toLowerCase());
  }
  return Object.fromEntries(
    Object.entries(headers).filter(([header, value]) => value !== undefined && !excluded.has(header.toLowerCase())),
  ) as Record<string, T>;
}

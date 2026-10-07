/** Bound provider bodies independently of the upstream Content-Length header. */
export async function boundedJson(response: Response, limit = 2_000_000): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Provider returned an empty response.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Provider JSON response exceeded the local size limit.'); chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}

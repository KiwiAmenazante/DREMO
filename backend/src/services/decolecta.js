import { z } from 'zod';

const ResponseSchema = z.object({
  first_name: z.string().optional(),
  first_last_name: z.string().optional(),
  second_last_name: z.string().optional(),
  full_name: z.string().optional(),
  document_number: z.string().optional(),
});

export async function queryDecolectaDni(dni) {
  const token = process.env.DECOLECTA_TOKEN?.trim();
  const baseUrl =
    process.env.DECOLECTA_API_URL?.trim() || 'https://api.decolecta.com/v1/reniec/dni';

  if (!token) {
    return { success: false, message: 'Missing DECOLECTA_TOKEN' };
  }

  const url = new URL(baseUrl);
  url.searchParams.set('numero', String(dni));

  let resp;
  try {
    resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: token,
      },
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error calling fallback: ${err.message}`
          : 'Network error calling fallback',
    };
  }

  const rawText = await resp.text();

  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    return {
      success: false,
      message: `Fallback returned non-JSON (HTTP ${resp.status})`,
    };
  }

  if (!resp.ok) {
    return {
      success: false,
      message:
        (typeof json?.message === 'string' && json.message) ||
        `Fallback HTTP ${resp.status}`,
    };
  }

  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, message: 'Unexpected fallback response shape' };
  }

  return { success: true, data: parsed.data };
}

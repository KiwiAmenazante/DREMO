import { z } from 'zod';

const NullableString = z.string().nullable().optional();
const NullableVerificationCode = z
  .union([z.number(), z.string()])
  .nullable()
  .optional();

const ResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      number: NullableString,
      full_name: NullableString,
      name: NullableString,
      surname: NullableString,
      verification_code: NullableVerificationCode,
      first_last_name: NullableString,
      second_last_name: NullableString,
      date_of_birth: NullableString,
      gender: NullableString,
      department: NullableString,
      province: NullableString,
      district: NullableString,
      address: NullableString,
      address_complete: NullableString,
      ubigeo: NullableString,
      ubigeo_sunat: NullableString,
    })
    .passthrough()
    .optional(),
});

export async function queryConsultasPeruDni(dni) {
  const apiUrl = process.env.CONSULTASPERU_API_URL?.trim();
  const token = process.env.CONSULTASPERU_TOKEN?.trim();

  if (!apiUrl) {
    return { success: false, message: 'Missing CONSULTASPERU_API_URL' };
  }
  if (!token) {
    return { success: false, message: 'Missing CONSULTASPERU_TOKEN' };
  }

  const body = {
    token,
    type_document: 'dni',
    document_number: dni,
  };

  let resp;
  try {
    resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? `Network error calling upstream: ${err.message}`
          : 'Network error calling upstream',
    };
  }

  const rawText = await resp.text();

  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    return {
      success: false,
      message: `Upstream returned non-JSON (HTTP ${resp.status})`,
    };
  }

  if (!resp.ok) {
    const parsed = ResponseSchema.safeParse(json);
    if (parsed.success) {
      return {
        success: false,
        message: parsed.data.message ?? `Upstream HTTP ${resp.status}`,
      };
    }

    return {
      success: false,
      message: `Upstream HTTP ${resp.status}`,
    };
  }

  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, message: 'Unexpected upstream response shape' };
  }

  return parsed.data;
}

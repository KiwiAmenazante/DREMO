import { z } from 'zod';
import { queryConsultasPeruDni } from '../services/consultasPeru.js';
import { queryDecolectaDni } from '../services/decolecta.js';
import { findCodeByDniEmailPrefix } from '../services/googleSheets.js';

const BodySchema = z.object({
  dni: z
    .string()
    .trim()
    .regex(/^\d{8}$/, 'DNI must be 8 digits'),
});

export async function validateDniHandler(req, res) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Invalid request body',
      errors: parsed.error.flatten(),
    });
  }

  const { dni } = parsed.data;

  try {
    const primary = await queryConsultasPeruDni(dni);

    let identity = primary;
    let identitySource = 'consultasperu';

    if (!primary.success) {
      const fallback = await queryDecolectaDni(dni);

      if (fallback.success) {
        identitySource = 'decolecta';
        identity = {
          success: true,
          data: {
            number: fallback.data.document_number ?? null,
            full_name: fallback.data.full_name ?? null,
            name: fallback.data.first_name ?? null,
            surname: `${fallback.data.first_last_name ?? ''} ${fallback.data.second_last_name ?? ''}`
              .trim()
              .replace(/\s+/g, ' ') || null,
            verification_code: null,
          },
        };
      } else {
        return res.status(502).json({
          success: false,
          message: primary.message ?? fallback.message ?? 'Upstream API error',
        });
      }
    }

    const sheetMatch = await findCodeByDniEmailPrefix(dni);

    return res.json({
      success: true,
      message: 'OK',
      dni,
      identitySource,
      consultasPeru: identity.data,
      sheet: sheetMatch,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('validateDniHandler error:', err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      ...(process.env.NODE_ENV === 'production'
        ? {}
        : {
            error: err instanceof Error ? err.message : String(err),
          }),
    });
  }
}

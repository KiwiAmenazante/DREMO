import { z } from 'zod';
import { queryConsultasPeruDni } from '../services/consultasPeru.js';
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
    const consultas = await queryConsultasPeruDni(dni);

    if (!consultas.success) {
      return res.status(502).json({
        success: false,
        message: consultas.message ?? 'Upstream API error',
      });
    }

    const sheetMatch = await findCodeByDniEmailPrefix(dni);

    return res.json({
      success: true,
      message: 'OK',
      dni,
      consultasPeru: consultas.data,
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

import { google } from 'googleapis';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function maskEmail(email) {
  const trimmed = String(email ?? '').trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);

  if (local.length <= 2) return `${local[0] ?? '*'}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

function getServiceAccountCredentials() {
  const jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonString) {
    return JSON.parse(jsonString);
  }

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (keyFile) {
    return { keyFile };
  }

  return null;
}

async function getSheetsClient() {
  const authOptions = getServiceAccountCredentials();

  if (!authOptions) {
    throw new Error(
      'Google Sheets credentials missing (set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_FILE)'
    );
  }

  const auth =
    'keyFile' in authOptions
      ? new google.auth.GoogleAuth({
          keyFile: authOptions.keyFile,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        })
      : new google.auth.GoogleAuth({
          credentials: authOptions,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

export async function findCodeByDniEmailPrefix(dni) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE;

  if (!spreadsheetId || !range) {
    return {
      matched: false,
      skipped: true,
      reason: 'Google Sheets not configured (set GOOGLE_SHEET_ID and GOOGLE_SHEET_RANGE)',
    };
  }

  const emailColIndex = Number(process.env.GOOGLE_SHEET_EMAIL_COL_INDEX ?? 0);
  const codeColIndex = Number(process.env.GOOGLE_SHEET_CODE_COL_INDEX ?? 1);

  try {
    const sheets = await getSheetsClient();

    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = resp.data.values ?? [];
    const targetPrefix = String(dni);

    for (const row of rows) {
      const email = String(row[emailColIndex] ?? '').trim();
      if (!email) continue;

      if (email.startsWith(targetPrefix)) {
        const code = String(row[codeColIndex] ?? '').trim();
        return {
          matched: true,
          emailMasked: maskEmail(email),
          code: code || null,
        };
      }
    }

    return {
      matched: false,
    };
  } catch (err) {
    return {
      matched: false,
      error: true,
      reason: err instanceof Error ? err.message : 'Google Sheets error',
    };
  }
}

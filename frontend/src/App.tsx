import { useState } from 'react'
import './App.css'

type ValidateResponse = {
  success: boolean
  message?: string
  dni?: string
  identitySource?: 'consultasperu' | 'decolecta'
  consultasPeru?: {
    number?: string
    full_name?: string
    name?: string
    surname?: string
    verification_code?: number | string
    [k: string]: unknown
  }
  sheet?:
    | {
        matched: true
        emailMasked?: string
        code?: string | null
      }
    | {
        matched: false
        error?: boolean
        skipped?: boolean
        reason?: string
      }
}

type ResultVariant = 'success' | 'warning' | 'danger'

type ResultCard = {
  variant: ResultVariant
  title: string
  message: string
  identitySourceLabel?: string
  sheetLabel?: string
  sheetHint?: string
}

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/g, '')
const validateDniUrl = apiBaseUrl ? `${apiBaseUrl}/api/validate-dni` : '/api/validate-dni'

function App() {
  const [dni, setDni] = useState('')
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [verificationDigit, setVerificationDigit] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultCard | null>(null)
  const [sheetCode, setSheetCode] = useState<string | null>(null)
  const [canRequestCode, setCanRequestCode] = useState(false)
  const [codeModalOpen, setCodeModalOpen] = useState(false)
  const [codeVisible, setCodeVisible] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  function onDniChange(value: string) {
    // Keep only digits and limit to 8 characters.
    const digitsOnly = value.replace(/\D+/g, '').slice(0, 8)
    setDni(digitsOnly)
  }

  function onVerificationDigitChange(value: string) {
    // Digito identificador: keep only digits, 1 char.
    const digit = value.replace(/\D+/g, '').slice(0, 1)
    setVerificationDigit(digit)
  }

  function normalizeText(value: string) {
    const trimmed = value.trim().replace(/\s+/g, ' ')
    try {
      return trimmed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
    } catch {
      return trimmed.toUpperCase()
    }
  }

  function maskCode(code: string) {
    const trimmed = String(code ?? '').trim()
    if (!trimmed) return '—'
    if (trimmed.length <= 2) return '••'
    if (trimmed.length <= 4) return `${trimmed[0]}•••`
    const head = trimmed.slice(0, 2)
    const tail = trimmed.slice(-2)
    const middle = '•'.repeat(Math.max(2, trimmed.length - 4))
    return `${head}${middle}${tail}`
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    setSheetCode(null)
    setCanRequestCode(false)
    setCodeModalOpen(false)
    setCodeVisible(false)
    setCopyMessage(null)

    const cleaned = dni.trim()
    if (!/^\d{8}$/.test(cleaned)) {
      setError('El DNI debe tener 8 dígitos.')
      return
    }

    const cleanedName = firstName.trim()
    if (!cleanedName) {
      setError('Ingresa el nombre.')
      return
    }

    const cleanedSurname = surname.trim()
    if (!cleanedSurname) {
      setError('Ingresa el/los apellido(s).')
      return
    }

    const cleanedDigit = verificationDigit.trim()
    if (cleanedDigit && !/^\d$/.test(cleanedDigit)) {
      setError('El dígito identificador debe ser 1 dígito (opcional).')
      return
    }

    setLoading(true)
    try {
      const resp = await fetch(validateDniUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: cleaned }),
      })

      const json = (await resp.json()) as ValidateResponse
      if (!resp.ok || !json.success) {
        setError(json.message ?? 'No se pudo validar el DNI.')
        return
      }

      const identitySource = json.identitySource ?? 'consultasperu'
      const identitySourceLabel =
        identitySource === 'decolecta' ? 'RENIEC (Decolecta)' : 'ConsultasPeru'

      const apiName = normalizeText(String(json.consultasPeru?.name ?? ''))
      const apiSurname = normalizeText(String(json.consultasPeru?.surname ?? ''))
      const apiDigit = String(json.consultasPeru?.verification_code ?? '').trim()

      const inputName = normalizeText(cleanedName)
      const inputSurname = normalizeText(cleanedSurname)
      const inputDigit = cleanedDigit

      const baseMatches =
        apiName.length > 0 &&
        apiSurname.length > 0 &&
        apiName === inputName &&
        apiSurname === inputSurname

      const digitMatches = apiDigit.length > 0 ? apiDigit === inputDigit : true

      const matchesIdentity = baseMatches && digitMatches

      const matchesSheet = Boolean(json.sheet?.matched)
      const maskedEmail = json.sheet?.matched ? json.sheet.emailMasked : undefined
      const codeFromSheet = json.sheet?.matched ? (json.sheet.code ?? null) : null

      const sheetLabel =
        json.sheet?.matched
          ? maskedEmail
            ? `Correo registrado (${maskedEmail})`
            : 'Correo registrado'
          : json.sheet && 'error' in json.sheet && json.sheet.error
            ? 'Google Sheets: error'
            : json.sheet && 'skipped' in json.sheet && json.sheet.skipped
              ? 'Google Sheets: omitido'
              : 'Correo no registrado'

      const sheetHint =
        json.sheet && 'reason' in json.sheet && json.sheet.reason
          ? String(json.sheet.reason)
          : undefined

      if (!matchesIdentity) {
        setResult({
          variant: 'danger',
          title: 'Verificación no confirmada',
          message:
            apiDigit.length > 0
              ? 'Los datos ingresados no coinciden con la consulta.'
              : 'Los datos ingresados no coinciden con la consulta (sin dígito de verificación disponible).',
          identitySourceLabel,
          sheetLabel,
          sheetHint,
        })
      } else if (matchesSheet) {
        setResult({
          variant: 'success',
          title: 'Confirmación',
          message: 'Los datos coinciden y el correo está registrado.',
          identitySourceLabel,
          sheetLabel,
          sheetHint,
        })

        setSheetCode(codeFromSheet)
        setCanRequestCode(Boolean(codeFromSheet))
      } else {
        setResult({
          variant: 'warning',
          title: 'Identidad validada',
          message:
            'Los datos coinciden, pero no se encontró un correo registrado que empiece con el DNI.',
          identitySourceLabel,
          sheetLabel,
          sheetHint,
        })
      }

    } catch {
      setError('Error de red o del servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <h1 className="title">Validador de DNI</h1>
            <p className="subtitle">Consulta y verificación</p>
          </div>
        </div>
      </header>

      <main className="container">
        <p className="welcome">
          Bienvenido. Ingrese sus datos para validar la identidad.
        </p>

        <section className="panel" aria-label="Formulario de validación">
          <form onSubmit={onSubmit} className="form" noValidate>
            <div className="grid">
              <label className="field">
                <span className="label">DNI</span>
                <input
                  className="input"
                  value={dni}
                  onChange={(e) => onDniChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12346578"
                  maxLength={8}
                  aria-invalid={Boolean(error)}
                />
                <span className="hint">Debe contener exactamente 8 dígitos.</span>
              </label>

              <label className="field">
                <span className="label">Dígito identificador</span>
                <input
                  className="input"
                  value={verificationDigit}
                  onChange={(e) => onVerificationDigitChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  maxLength={1}
                  aria-invalid={Boolean(error)}
                />
                <span className="hint">1 dígito (código de verificación).</span>
              </label>
            </div>

            <label className="field">
              <span className="label">Nombre</span>
              <input
                className="input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="off"
                placeholder="Ej.: JUAN CARLOS (según RENIEC)"
                aria-invalid={Boolean(error)}
              />
            </label>

            <label className="field">
              <span className="label">Apellido(s)</span>
              <input
                className="input"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                autoComplete="off"
                placeholder="Ej.: PEREZ GONZALES (apellido paterno y materno)"
                aria-invalid={Boolean(error)}
              />
            </label>

            <div className="actions">
              <button className="button primary" type="submit" disabled={loading}>
                {loading ? 'Consultando…' : 'Validar'}
              </button>
              <button
                className="button"
                type="button"
                disabled={loading}
                onClick={() => {
                  setDni('')
                  setFirstName('')
                  setSurname('')
                  setVerificationDigit('')
                  setError(null)
                  setResult(null)
                  setSheetCode(null)
                  setCanRequestCode(false)
                  setCodeModalOpen(false)
                  setCodeVisible(false)
                }}
              >
                Limpiar
              </button>
            </div>
          </form>

          {error ? (
            <div className="alert" role="alert">
              {error}
            </div>
          ) : null}

          {result ? (
            <div
              className={`resultCard result${result.variant}`}
              role="status"
              aria-label="Resultado de validación"
            >
              <div className="resultTop">
                <div className="resultTitleRow">
                  <div className="resultIcon" aria-hidden="true">
                    {result.variant === 'success' ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M20 6 9 17l-5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : result.variant === 'warning' ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 9v4"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 17h.01"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M15 9l-6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 9l6 6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="resultHead">
                    <div className="resultTitle">{result.title}</div>
                    <div className="resultMeta">
                      {result.identitySourceLabel ? (
                        <span className="chip">Fuente: {result.identitySourceLabel}</span>
                      ) : null}
                      {result.sheetLabel ? (
                        <span className="chip chipMuted">{result.sheetLabel}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {canRequestCode ? (
                  <button
                    type="button"
                    className="button small primary"
                    onClick={() => setCodeModalOpen(true)}
                  >
                    Solicitar contraseña
                  </button>
                ) : null}
              </div>

              <div className="resultMessage">{result.message}</div>

              {result.sheetHint ? (
                <div className="resultHint">{result.sheetHint}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        {codeModalOpen ? (
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Contraseña del usuario"
            onClick={() => setCodeModalOpen(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div className="modalTitle">Contraseña del usuario</div>
                <button
                  type="button"
                  className="iconButton"
                  aria-label="Cerrar"
                  onClick={() => setCodeModalOpen(false)}
                >
                  X
                </button>
              </div>

              <div className="modalBody">
                <div className="codeRow">
                  <div className="codeBox" aria-label="Código">
                    {sheetCode
                      ? codeVisible
                        ? sheetCode
                        : maskCode(sheetCode)
                      : '—'}
                  </div>
                  <button
                    type="button"
                    className="iconButton"
                    aria-label="Copiar código"
                    onClick={async () => {
                      if (!sheetCode) return

                      try {
                        if (navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(sheetCode)
                        } else {
                          const textarea = document.createElement('textarea')
                          textarea.value = sheetCode
                          textarea.setAttribute('readonly', '')
                          textarea.style.position = 'fixed'
                          textarea.style.top = '0'
                          textarea.style.left = '0'
                          textarea.style.opacity = '0'
                          document.body.appendChild(textarea)
                          textarea.select()
                          document.execCommand('copy')
                          document.body.removeChild(textarea)
                        }

                        setCopyMessage('Copiado al portapapeles')
                        window.setTimeout(() => setCopyMessage(null), 1500)
                      } catch {
                        setCopyMessage('No se pudo copiar')
                        window.setTimeout(() => setCopyMessage(null), 2000)
                      }
                    }}
                    disabled={!sheetCode}
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 9h10v12H9V9Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="iconButton"
                    aria-label={codeVisible ? 'Ocultar código' : 'Mostrar código'}
                    onClick={() => setCodeVisible((v) => !v)}
                    disabled={!sheetCode}
                  >
                    {codeVisible ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M4 4l16 16"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.3 5.6A10.3 10.3 0 0 1 12 5c5.5 0 9 7 9 7a18.7 18.7 0 0 1-3.2 4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.8 8.5C4.8 10.6 3 12 3 12s3.5 7 9 7c1 0 2-.2 2.9-.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="modalHint">
                  Por seguridad, el código se muestra censurado por defecto.
                </div>

                {copyMessage ? (
                  <div className="modalHint" role="status">
                    {copyMessage}
                  </div>
                ) : null}

                <div className="modalActions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => setCodeModalOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default App

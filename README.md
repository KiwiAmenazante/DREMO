# DNI Validator (ConsultasPeru + Google Sheets)

Proyecto full-stack:
- `backend/`: Express API que llama a ConsultasPeru y consulta Google Sheets.
- `frontend/`: React (Vite) UI mínima para validar DNI.

## Requisitos
- Node.js 18+ (recomendado 20+)
- Un Google Sheet con columnas: Email | Código (o similar)
- Service Account de Google con acceso de solo lectura a Sheets

## Configuración (Backend)
1. Copia `backend/.env.example` a `backend/.env` y completa variables.
2. Para que `/api/validate-dni` funcione, configura `CONSULTASPERU_API_URL` y `CONSULTASPERU_TOKEN` en `backend/.env`.
3. (Opcional) Si vas a validar contra Google Sheets:
	- Descarga el JSON del service account y guárdalo como `backend/service-account.json`.
	- En `backend/.env`, asegúrate de tener `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json` (o usa `GOOGLE_SERVICE_ACCOUNT_JSON`).
	- Comparte tu Google Sheet con el email del service account (permiso: lector) y configura `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_RANGE`.

## Ejecutar
Desde la raíz:
- `npm install`
- `npm run dev`

Backend: `http://localhost:3001`
Frontend: `http://localhost:5173`

## Problemas comunes
- Si en el navegador ves `502 (Bad Gateway)` en `http://localhost:5173/api/validate-dni`, normalmente es porque:
	- el backend no está levantado en `http://localhost:3001`, o
	- faltan variables en `backend/.env` (por ejemplo `CONSULTASPERU_API_URL` / `CONSULTASPERU_TOKEN`), o
	- ConsultasPeru está respondiendo con error (token inválido, rate limit, etc.).

Para comprobar rápido:
- `http://localhost:3001/health` debe responder `{ "ok": true }`.
- Prueba el endpoint directo:
	- `POST http://localhost:3001/api/validate-dni` con body `{ "dni": "40332292" }`.

## Endpoint
POST `http://localhost:3001/api/validate-dni`

Body:
```json
{ "dni": "40332292" }
```

## Deploy a Firebase (Hosting + Functions)

Este repo ya está preparado para desplegar:
- Frontend (Vite) en **Firebase Hosting**.
- Backend (Express) como **Cloud Functions for Firebase** y un rewrite `/api/**`.

### 1) Requisitos
- Tener un proyecto Firebase creado.
- En la consola de Firebase, normalmente necesitas el plan **Blaze** para desplegar Functions.

### 2) Login y seleccionar proyecto
En la raíz del repo:
- `firebase login`
- `firebase use --add`

Eso creará/actualizará `.firebaserc` con tu project id.

### 3) Configurar variables de entorno del backend
Firebase Functions inyecta variables en runtime. La forma más simple aquí es usar un archivo:

- Crea `backend/.env.<TU_FIREBASE_PROJECT_ID>` (por ejemplo `backend/.env.mi-proyecto-123`).

Variables mínimas (ConsultasPeru):
```env
CONSULTASPERU_API_URL=https://...
CONSULTASPERU_TOKEN=...
```

Opcional (API secundaria Decolecta, usada como fallback si ConsultasPeru falla):
```env
DECOLECTA_API_URL=https://api.decolecta.com/v1/reniec/dni
DECOLECTA_TOKEN=...
```

Opcional (Google Sheets):
```env
GOOGLE_SHEET_ID=...
GOOGLE_SHEET_RANGE=Hoja1!A:B
GOOGLE_SHEET_EMAIL_COL_INDEX=0
GOOGLE_SHEET_CODE_COL_INDEX=1
```

Credenciales Sheets (elige una):
- Recomendado en deploy: `GOOGLE_SERVICE_ACCOUNT_JSON` (JSON en una sola línea; el `private_key` debe llevar `\\n` escapados).

Nota: `backend/.env*` ya está ignorado por git (ver `.gitignore`).

### 4) Instalar dependencias y build del frontend
Desde la raíz:
- `npm install`
- `npm run build -w frontend`

### 5) Deploy
Desde la raíz:
- `firebase deploy --only functions,hosting`

Cuando termine:
- Tu UI estará en Hosting.
- La API quedará disponible en el mismo dominio bajo `/api/validate-dni`.

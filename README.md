# Grand Line RPG

Juego de rol cooperativo multijugador con narrador IA en tiempo real. Universo inspirado en One Piece con personajes y aventuras 100% originales. PWA instalable.

## Stack

- **Frontend:** React 19 + Vite 8 + Tailwind CSS v4
- **Base de datos:** Supabase (PostgreSQL + Realtime + Presence)
- **IA Narrador:** Groq (llama-4-scout, llama-3.3-70b, kimi-k2)
- **Voz:** Google Cloud TTS + Web Speech API (fallback)
- **Deploy:** Vercel
- **PWA:** vite-plugin-pwa + Workbox

## Setup local

### Prerrequisitos

- Node.js 20+
- npm

### Instalacion

```bash
git clone <repo-url>
cd rpg-chat-game
npm install
```

### Variables de entorno

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable | Requerida | Descripcion |
|---|---|---|
| `VITE_SUPABASE_URL` | Si | URL del proyecto Supabase |
| `VITE_SUPABASE_KEY` | Si | Clave anonima (anon key) de Supabase |
| `VITE_GROQ_API_KEY` | Si | API key de Groq para modelos IA |
| `VITE_GOOGLE_TTS_API_KEY` | No | API key de Google Cloud TTS. Sin ella usa Web Speech API |

### Desarrollo

```bash
npm run dev
```

Abre `http://localhost:5174`.

### Build

```bash
npm run build
npm run preview  # vista previa local del build
```

## Deploy en Vercel

El proyecto incluye `vercel.json` con configuracion SPA (rewrite a index.html). Las variables de entorno deben configurarse en el dashboard de Vercel.

## Base de datos

El proyecto usa Supabase. Las migraciones se aplican desde el dashboard de Supabase o con el CLI. Consulta `CLAUDE.md` para detalles del esquema.

## Documentacion para contribuidores

Ver [CLAUDE.md](CLAUDE.md) para la guia completa del proyecto: estructura de carpetas, sistema de diseno, convenciones, skills de agente y estado actual.

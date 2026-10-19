# Stranger Sky - Web (User App)

Next.js 15 user application for Stranger Sky.

## Setup
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Configure `NEXT_PUBLIC_API_URL` to point to your API server (e.g. Render server URL).
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

## Deploy on Vercel
Deploy as a Next.js project with `NEXT_PUBLIC_API_URL` set to your API server URL.

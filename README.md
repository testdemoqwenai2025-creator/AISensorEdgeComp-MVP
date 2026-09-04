# AISensorEdgeComp — Live MVP Dashboard

> Live IoT sensor mesh + edge AI inference + natural-language query layer.
> Deployable Next.js 16 app demonstrating the AISensorEdgeComp platform.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **State**: React hooks + TanStack Query (available)
- **Charts**: Recharts
- **AI**: z-ai-web-dev-sdk (server-side only, in `/api/search`)
- **Theme**: next-themes (dark/light toggle)
- **Auth**: Demo mock in `/api/login` (NextAuth.js + Prisma at GA)

## Features

- Live sensor mesh: 8 simulated multi-modal sensors (vibration, temperature, pressure, gas, vision, soil) — polling every 3s with realistic sine + noise patterns and occasional injected anomalies
- Edge AI panel: liquid workload placement visualization (edge vs cloud inference routing)
- Time-series foundation model: streaming 4-modal chart with confidence scores
- Search with AI: natural-language Q&A grounded in platform architecture (uses z-ai-web-dev-sdk via `/api/search`)
- Login dialog: demo auth with email/password (mock token returned)
- Dark/light theme: persisted via next-themes
- Responsive: mobile-first design

## Run locally

```bash
# Prerequisites: Node.js 20+, bun (or npm/pnpm)
bun install
bun run dev   # http://localhost:3000
```

> Note: `z-ai-web-dev-sdk` requires a `.z-ai-config` file at the project root
> with `baseUrl`, `apiKey`, and `chatId` fields. The SDK will fall back to a
> rule-based answer if the LLM call fails.

## API routes

- `GET /api/sensors` — simulated sensor mesh data (polling endpoint)
- `POST /api/search` — natural-language query via z-ai-web-dev-sdk (server-side only)
- `POST /api/login` — demo authentication

## Project structure

```
src/
├── app/
│   ├── layout.tsx           # Root layout (ThemeProvider + metadata)
│   ├── page.tsx             # Dashboard (only visible route)
│   ├── globals.css          # Tailwind 4 + cyan/violet theme
│   └── api/
│       ├── sensors/route.ts # Simulated sensor mesh
│       ├── search/route.ts  # AI search via z-ai-web-dev-sdk
│       └── login/route.ts   # Demo auth
├── components/ui/           # shadcn/ui components (preinstalled)
└── hooks/                   # Custom hooks (use-toast, use-mobile)
```

## About

AISensorEdgeComp is a planetary-scale IoT + edge AI platform.
- Investor preview: https://testdemoqwenai2025-creator.github.io/DemoSentinelEdge/
- Technical deep dive: https://testdemoqwenai2025-creator.github.io/DemoSentinelEdge/architecture-deep.html
- For briefings: partners@aisensoredgecomp.ai

© 2026 AISensorEdgeComp · MVP v0.4 · For demo only

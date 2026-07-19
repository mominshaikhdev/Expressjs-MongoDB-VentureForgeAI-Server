# VentureForge AI - Express API Server

This is the backend API server for **VentureForge AI**, powered by Node.js, Express, TypeScript, MongoDB, and Groq LLM APIs.

---

## 🛠️ Technology Stack

- **Server Engine**: Node.js & Express.js (TypeScript target ESM)
- **Database ORM**: Mongoose & MongoDB Node Client
- **Authentication**: Better Auth Server (reusing MongoDB client adapters for session management)
- **AI Reasoning**: Groq SDK (`llama-3.3-70b-versatile` for SWOT and CFO statements, `llama-3.1-8b-instant` for conversational coaching follow-up prompts, and `llama-3.2-11b-vision-preview` for multimodal image vision audits)
- **Compiler/Runner**: `tsx` (for hot-reloading development servers)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Boot Dev Server
```bash
pnpm dev
```
The server will start listening on [https://expressjs-mongo-db-venture-forge-ai.vercel.app](https://expressjs-mongo-db-venture-forge-ai.vercel.app).

---

## 📌 API Endpoint Index

### 1. Authentication (Better Auth Express Middleware)
- `ALL /api/auth/*` - Mounted Better Auth handler (handles signup, signin, session checks, social login redirect handlers).

### 2. Ventures CRUD
- `GET /api/ventures` - List all ventures. Supports query parameters for search, category filter, budget limits, score thresholds, and sort order.
- `GET /api/ventures/:id` - Fetch details for a specific venture.
- `POST /api/ventures` - Add a new venture. *Requires Authentication*. Triggers Groq validation to score the project, output SWOT points, tech stack, and competitors.
- `DELETE /api/ventures/:id` - Delete a venture. *Requires Authentication (Owner-only)*.

### 3. Agentic AI Features (Groq LLM)
- `POST /api/ai/chat` - Conversational dialogue with VentureMentor. *Requires Authentication*. Grounded in the venture details. Returns replies, generated follow-up prompts, and appends messages to DB.
- `GET /api/ai/chat/history/:ventureId` - Retrieve chat transcripts for a project. *Requires Authentication*.
- `POST /api/ai/analyze-financials` - Ingests Year/Revenue/Expense ledgers, updates Mongoose schema, and compiles a written audit report from Groq CFO. *Requires Authentication*.
- `POST /api/ai/digest-pitch` - Ingests document texts and returns bullet summaries, key risks, next actions, and auto-classified tags. *Requires Authentication*.
- `POST /api/ai/analyze-image` - Ingests base64 images and generates descriptive layout audits via Llama 3.2 Vision. *Requires Authentication*.

# NeedBoard — Collective Problem Clustering Platform (Prototype)

NeedBoard is an interactive, vector-driven web application where anyone can post a problem, complaint, or frustration about literally anything. Using advanced vector search (Pinecone) and LLM classification (Anthropic, OpenAI, Vertex AI, and other customizable endpoints), the system automatically categorizes each submission and clusters similar underlying frustrations into collective signals.

## 🌟 Core Features

- **Ambient Live Clustering Canvas:** An interactive, background canvas of glowing nodes that slowly drift and connect, visually depicting raw user complaints gravitating into clusters in vector space.
- **Surgical Custom Cursor:** An ultra-smooth, magnetic, spring-animated custom cursor utilizing `mix-blend-mode: difference` for high-impact visual feedback.
- **Submit Frustration Flow:** A state-orchestrated flow where complaints are embedded, analyzed, matched with existing clusters, or classified by an LLM to seed new clusters.
- **Category Taxonomy:** A dynamic index of clusters and problem streams compiled directly from Pinecone vector metadata counts.
- **Semantic Free-Text Scan:** Nearest-neighbor semantic search over active cluster centroids, mapping meanings rather than exact keywords.
- **Interactive "Me Too" Affirmation:** Instantly co-sign active clusters, fortifying their signal strength, or submit a custom wording variant.

---

## 🚀 Getting Started

### 1. Installation
Install the project dependencies:
```bash
npm install
```

### 2. Environment Variables
Create a local `.env` file by copying the example template:
```bash
cp .env.example .env
```

Open `.env` and fill out your credentials. The environment variables are organized into explicit categories:

#### A. Pinecone (Vector Database)
- `PINECONE_API_KEY`: Your Pinecone personal access key.
- `PINECONE_INDEX`: The name of your index (e.g., `NeedBoard-problems`).
  - *Recommendation:* Create an index with **1536 dimensions** and **Cosine similarity** metrics (matching standard embeddings like OpenAI `text-embedding-3-small`).

#### B. Clerk Authentication (Required)
Protects the heavy AI calculation routes from misuse and spam.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Obtain this from your Clerk dashboard.
- `CLERK_SECRET_KEY`: Clerk private secret key.
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`: Set this to your absolute Clerk Accounts Portal sign-in subpage (e.g., `https://current-ferret-93.accounts.dev/sign-in`).
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`: Set this to your absolute Clerk Accounts Portal sign-up subpage (e.g., `https://current-ferret-93.accounts.dev/sign-up`).
  - *Crucial note:* Because NeedBoard uses Clerk's native modal and hosted portals, setting these to absolute hosted URLs ensures Clerk's middleware redirects unauthenticated API queries directly to your hosted portal instead of local subpaths (which would return 404).

#### C. Control Thresholds & Safety
- `NEXT_PUBLIC_SIMILARITY_THRESHOLD`: Cosine similarity cutoff (defaults to `0.85`). Increase to keep clusters tightly related; decrease to merge broader wording together.
- `NEXT_PUBLIC_MAX_QUERY_CHARS`: Maximum allowed characters for queries (defaults to `500`).
  - **Safety Guardrail:** If an input exceeds this character count, both the frontend and backend instantly halt processing and alert the user to shorten it themselves. This prevents long, token-draining spam prompts from executing.
- `RATE_LIMIT_MAX_REQUESTS`: Standard API rate limit (defaults to `10` requests per window).
- `RATE_LIMIT_WINDOW_MS`: Rate limiting sliding window in milliseconds (defaults to `60000` / 1 minute).

---

## 🤖 Configuring AI & Embedding Providers

NeedBoard is fully modular and supports several LLM and Embedding providers, selectable via `LLM_PROVIDER` and `EMBEDDING_PROVIDER` in your `.env`.

### 1. OpenAI (Default)
Set:
```env
LLM_PROVIDER=openai
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key
OPENAI_COMPLETION_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 2. Anthropic (LLM Only)
Anthropic's fast and precise Claude models are excellent for taxonomy classification.
Set:
```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_COMPLETION_MODEL=claude-3-5-haiku-20241022
```

### 3. Google Vertex AI
Fully supports enterprise authentication.
Set:
```env
LLM_PROVIDER=vertexai
EMBEDDING_PROVIDER=vertexai
VERTEX_PROJECT_ID=your-gcp-project-id
VERTEX_LOCATION=us-central1
VERTEX_API_ENDPOINT=us-central1-aiplatform.googleapis.com
```
*Authentication Details:*
Vertex AI REST calls authenticate using a bearer token. In local development or production, you can provide `GCP_ACCESS_TOKEN` as an environment variable (generated via `gcloud auth print-access-token`), or standard ADC (Application Default Credentials) via `VERTEX_SERVICE_ACCOUNT_KEY_JSON`.

### 4. NVIDIA NIM
For blazing fast, cost-efficient local or cloud-based completions and embeddings.
Set:
```env
LLM_PROVIDER=nvidia
EMBEDDING_PROVIDER=nvidia
NVIDIA_API_KEY=your-nvidia-nim-api-key
NVIDIA_COMPLETION_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_EMBEDDING_MODEL=nvidia/llama-3.2-nv-embedqc-1
```

### 5. Cerebras (LLM Only)
Uses Cerebras CS-3 wafer-scale engines for ultra-low latency completions.
Set:
```env
LLM_PROVIDER=cerebras
CEREBRAS_API_KEY=your-cerebras-api-key
CEREBRAS_COMPLETION_MODEL=llama3.1-8b
```

### 6. OpenRouter
Enables routing queries to any open-source or proprietary model under a single key.
Set:
```env
LLM_PROVIDER=openrouter
EMBEDDING_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_COMPLETION_MODEL=meta-llama/llama-3.1-8b-instruct
OPENROUTER_EMBEDDING_MODEL=openai/text-embedding-3-small
```

### 7. Local fallback (Embedding Only)
Allows running and testing the app frontend completely **without active API keys or connection to paid services**.
Set:
```env
EMBEDDING_PROVIDER=local-fallback
```
This maps input queries into deterministic, high-dimensional normalized vector fields (1536d) dynamically, letting you fully test clustering, similarity matching, and browse directories locally.

### 8. Resend (Email Notifications)
Enables automatic email alerts when builders list verified solutions to subscribed problem clusters.
Set:
```env
RESEND_API_KEY=your-resend-api-key
```
By default, the platform routes live notifications using our custom domain sender (`launch@mail.needboard.space`).

---

## 🛠️ Developer Seed Tool

Starting with an empty Pinecone database is boring! NeedBoard includes an interactive **Developer Seeding Tool** built directly into the UI.
1. When you first launch the app with an empty Pinecone index, a banner will appear at the top of the Home page.
2. Click **"Seed Data"** (or hit `GET /api/seed`).
3. The system will automatically construct **5 rich, realistic, category-distributed problem clusters** (Housing boiler breakdowns, Subway delays, Cookie dark patterns, Smart fridge screen freezes, and Delivery package theft) with complete variants in your Pinecone index.
4. Refresh, and watch the background ambient nodes come alive, pulsing and drifting based on these seed signals!

---

## 💻 Local Execution

Run the development server locally:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

To verify type safety and build accuracy, compile a production release:
```bash
npm run build
```

This project compiles clean with pristine type accuracy, optimized for edge and serverless rendering, ready for `vercel deploy`.

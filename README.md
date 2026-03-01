<p align="center">
  <img src="docs/logo-placeholder.png" alt="ShipScope" width="120" />
</p>

<h1 align="center">ShipScope</h1>

<p align="center">
  <strong>Open-source AI that analyzes customer feedback and tells you what to build next.</strong>
</p>

<p align="center">
  <a href="https://shipscope.dev">Website</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="docs/">Docs</a> ·
  <a href="https://github.com/shipscope/shipscope/issues">Issues</a> ·
  <a href="https://discord.gg/shipscope">Discord</a>
</p>

<p align="center">
  <a href="https://github.com/shipscope/shipscope/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>
  <a href="https://github.com/shipscope/shipscope/stargazers"><img src="https://img.shields.io/github/stars/shipscope/shipscope?style=social" alt="GitHub Stars" /></a>
  <a href="https://discord.gg/shipscope"><img src="https://img.shields.io/discord/000000000?label=discord" alt="Discord" /></a>
</p>

---

## The Problem

Cursor and Claude Code made writing code 10x faster. But the bottleneck shifted upstream — **deciding what to build** is now the hardest part. Product teams drown in scattered feedback across Intercom tickets, Slack threads, user interviews, and analytics dashboards. They make roadmap decisions on gut feel instead of evidence.

## The Solution

ShipScope ingests all your customer feedback, uses AI to find patterns, and tells you exactly what to build next — backed by evidence. Then it generates agent-ready specs you can feed directly to Cursor or Claude Code.

```
Customer Feedback → AI Synthesis → Feature Proposals → Agent-Ready Specs
```

### How it works

1. **Ingest** — Connect support tickets, interview transcripts, surveys, Slack messages, analytics, or import via CSV/API
2. **Synthesize** — AI clusters feedback into themes, extracts pain points, and scores opportunities
3. **Propose** — Get prioritized feature proposals backed by real user evidence ("142 users asked for this, power users 3x more likely to request it")
4. **Specify** — Generate full PRDs, user stories, and development tasks ready for your coding agent
5. **Ship** — Export to Linear, Jira, or GitHub Issues. Hand off specs to Cursor/Claude Code for implementation

## Quick Start

### Self-hosted (Docker)

```bash
git clone https://github.com/shipscope/shipscope.git
cd shipscope
cp .env.example .env  # Add your OpenAI/Anthropic API key
docker compose up -d
```

Open `http://localhost:3000` — your data stays on your infrastructure.

### Development Setup

```bash
# Prerequisites: Node.js 20+, PostgreSQL 16+, Redis

git clone https://github.com/shipscope/shipscope.git
cd shipscope
npm install
cp .env.example .env

# Setup database
npx prisma migrate dev

# Start all services
npm run dev
```

## Architecture

```
shipscope/
├── packages/
│   ├── web/          # React + TypeScript frontend (Vite)
│   ├── api/          # Node.js + Express backend
│   └── core/         # AI engine (ingestion, synthesis, proposals)
├── docs/             # Documentation
├── scripts/          # Setup and utility scripts
├── docker-compose.yml
└── .env.example
```

**Tech Stack:**
- **Frontend:** React 18, TypeScript, Tailwind CSS, Vite
- **Backend:** Node.js, Express, Prisma ORM
- **Database:** PostgreSQL + pgvector (embeddings)
- **Queue:** Redis + BullMQ (background jobs)
- **AI:** OpenAI / Anthropic API (BYO key)

## Features

### Available Now (v0.1)
- [ ] CSV/JSON feedback import
- [ ] Webhook API for real-time ingestion
- [ ] AI-powered feedback clustering and theme extraction
- [ ] Pain point identification with evidence linking
- [ ] Opportunity scoring (volume x segment value x urgency)
- [ ] Feature proposal generation with evidence
- [ ] Basic PRD generation
- [ ] Self-hosted Docker deployment

### Coming Soon
- [ ] Native integrations (Intercom, Zendesk, Slack, Discord)
- [ ] Analytics connectors (Mixpanel, Amplitude, PostHog)
- [ ] Interview transcript processing (audio to insights)
- [ ] Advanced prioritization frameworks (RICE, MoSCoW, custom)
- [ ] Agent-ready spec export (Cursor, Claude Code prompts)
- [ ] Linear / Jira / GitHub Issues export
- [ ] Team collaboration and workspaces
- [ ] SSO/SAML for enterprise

## Configuration

ShipScope uses environment variables for configuration:

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/shipscope
REDIS_URL=redis://localhost:6379

# AI Provider (choose one or both)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional
AI_MODEL=gpt-4o              # or claude-sonnet-4-20250514
EMBEDDING_MODEL=text-embedding-3-small
PORT=3000
```

## Contributing

We love contributions! ShipScope is built by the community, for the community.

Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before getting started.

- Report bugs — [Open an issue](https://github.com/shipscope/shipscope/issues/new?template=bug_report.md)
- Request features — [Open an issue](https://github.com/shipscope/shipscope/issues/new?template=feature_request.md)
- Improve docs — [docs/](docs/)
- Submit a PR — [CONTRIBUTING.md](CONTRIBUTING.md)

## Community

- [Discord](https://discord.gg/shipscope) — Chat with the team and other users
- [Twitter/X](https://twitter.com/shipscope) — Updates and announcements
- [Star us on GitHub](https://github.com/shipscope/shipscope) — It helps more than you think!

## License

ShipScope is open-source under the [AGPL-3.0 license](LICENSE).

- Free to use, modify, and self-host
- Free for commercial use within your organization
- If you modify and distribute as a service, you must open-source your changes

For enterprise licensing, contact hello@shipscope.dev.

---

<p align="center">
  <sub>Built for product teams who want to ship the right thing.</sub>
</p>

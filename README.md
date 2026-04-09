# Pulse ID

> Corporate identity lifecycle management platform — automated provisioning and deprovisioning across all services.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is Pulse ID?

When an employee joins or leaves a company, Pulse ID automatically provisions or revokes their access to every connected service — GitHub, Slack, Google Workspace, Jira, GitLab, and more — simultaneously and with full auditability.

Companies configure their stack by defining REST call templates with dynamic variables (`{username}`, `{email}`, `{password}`) or by integrating directly via API keys. Employees get a self-service portal to change their passwords across all services at once.

## Security Architecture

Pulse ID is built security-first:

- **Zero Trust provisioning** — least privilege by default on every new account
- **Credential Vault** — AES-256-GCM encryption, PBKDF2 key derivation, no plaintext storage ever
- **JWT + Refresh rotation** — short-lived access tokens (15min), rotating refresh tokens (7d)
- **MFA** — TOTP-based multi-factor authentication on the employee portal
- **Cryptographic audit log** — every entry is SHA-256 chained (hash includes previous entry hash), tamper-evident
- **Transactional rollback** — if provisioning fails midway (GitHub succeeded, Slack failed), already-created accounts are automatically reverted
- **Rate limiting** — per-endpoint and per-IP limits on all API routes
- **Anomaly detection** — automatic flagging when abnormal revocation patterns are detected
- **HTTP security headers** — HSTS, CSP, X-Frame-Options, and more

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL |
| Cache / Rate Limiting | Redis |
| Deploy | Self-hosted (Nginx + SSL) |

## Features

- **Employee lifecycle management** — onboarding and offboarding triggers
- **Service configurator** — REST templates with `{placeholder}` variable substitution
- **Parallel orchestration engine** — all service calls execute concurrently with transactional rollback
- **Encrypted credential vault** — secure storage for API keys and service credentials
- **Tamper-evident audit log** — cryptographically chained entries with integrity verification
- **Real-time dashboard** — live provisioning status per employee and service
- **Employee self-service portal** — unified password change across all connected services
- **Anomaly detection** — behavioral alerting for suspicious access patterns

## Project Structure

```
pulse-id/
├── frontend/          # Next.js application
│   ├── app/           # App Router pages
│   └── components/    # Shared UI components
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/       # Route handlers
│   │   ├── core/      # Vault, audit log, JWT logic
│   │   ├── models/    # SQLAlchemy models
│   │   └── services/  # Orchestration engine
│   └── alembic/       # DB migrations
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- Python 3.11+

### Development

```bash
# Start infrastructure
docker-compose up -d

# Frontend
cd frontend
npm install
npm run dev

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

## License

MIT — see [LICENSE](LICENSE) for details.

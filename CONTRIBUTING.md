# Contributing to ShipScope

First off, thank you for considering contributing to ShipScope! Every contribution helps make product discovery better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the behavior
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Node version, browser)

### Suggesting Features

Feature requests are welcome! Please open an issue with:

- A clear description of the feature
- The problem it solves
- Any alternative solutions you considered

### Submitting Code

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Make your changes
4. Write/update tests
5. Commit with conventional commits (`feat: add feedback import`)
6. Push to your fork
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/shipscope.git
cd shipscope

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start PostgreSQL and Redis (Docker)
docker compose up -d postgres redis

# Run database migrations
npx prisma migrate dev

# Start development servers
npm run dev
```

### Project Structure

```
packages/
  web/     → Frontend (React + Vite) — runs on :3000
  api/     → Backend (Express) — runs on :4000
  core/    → AI engine (shared library)
```

## Pull Request Process

1. Update documentation if you change any APIs or behavior
2. Ensure all tests pass (`npm test`)
3. Ensure linting passes (`npm run lint`)
4. Use conventional commit messages
5. Request review from a maintainer

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add CSV import for feedback
fix: resolve clustering timeout on large datasets
docs: update self-hosting guide
chore: upgrade dependencies
```

## Style Guide

- **TypeScript** for all code
- **Prettier** for formatting (runs on save)
- **ESLint** for linting
- Write meaningful variable names
- Comment the "why", not the "what"
- Keep functions small and focused

## Questions?

Join our [Discord](https://discord.gg/shipscope) or open a [Discussion](https://github.com/shipscope/shipscope/discussions).

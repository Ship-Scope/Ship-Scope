# 03 — Security Audit

## Objective

Conduct a systematic security audit of ShipScope covering the OWASP Top 10 web application risks. Harden input sanitization, lock down CORS, verify rate limiting, secure API key storage, enforce Content Security Policy headers, scan for dependency vulnerabilities, validate file uploads by content type, and enforce HTTPS in production. The goal is not theoretical compliance but verified, tested defenses against real attack vectors.

## Dependencies

- Phase 6: Complete (all endpoints and features exist to audit)
- Phase 2: Feedback ingestion (file upload and webhook endpoints to secure)
- Phase 4: API key management (key storage to harden)
- Phase 1: Express middleware stack (helmet already installed)

## Files to Create

| File                                              | Purpose                                           |
| ------------------------------------------------- | ------------------------------------------------- |
| `packages/api/src/middleware/sanitize.ts`         | Input sanitization middleware for XSS prevention  |
| `packages/api/src/middleware/security-headers.ts` | Helmet CSP and security header configuration      |
| `packages/api/src/lib/api-key.ts`                 | Secure API key hashing and timing-safe comparison |
| `packages/api/src/middleware/https-redirect.ts`   | HTTPS enforcement middleware for production       |
| `packages/api/src/__tests__/security.test.ts`     | Security-focused integration tests                |

## Files to Modify

| File                                        | Changes                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `packages/api/src/index.ts`                 | Register sanitization, security headers, HTTPS redirect middleware |
| `packages/api/src/middleware/cors.ts`       | Tighten CORS to whitelist-only origins                             |
| `packages/api/src/middleware/rate-limit.ts` | Verify all public endpoints are rate limited                       |
| `packages/api/src/routes/feedback.ts`       | Add file upload validation                                         |
| `packages/api/src/lib/logger.ts`            | Ensure secrets are never logged                                    |

## Detailed Sub-Tasks

### 1. Input sanitization — XSS prevention

Create `packages/api/src/middleware/sanitize.ts`:

```typescript
import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize all string fields in request body to prevent stored XSS.
 * Runs AFTER body parsing, BEFORE route handlers.
 *
 * Strategy: Strip all HTML tags from user input. Feedback content
 * is plain text — there is no legitimate reason for HTML tags.
 */
export function sanitizeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query as Record<string, unknown>);
  }
  next();
}

function sanitizeObject(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      // Strip ALL HTML tags — ShipScope content is plain text only
      obj[key] = DOMPurify.sanitize(value, { ALLOWED_TAGS: [] });
    } else if (typeof value === 'object' && value !== null) {
      sanitizeObject(value as Record<string, unknown>);
    }
  }
}
```

Install dependency:

```bash
npm install isomorphic-dompurify --workspace=packages/api
```

**Why DOMPurify over manual regex:** Regex-based sanitization is notoriously error-prone. DOMPurify is battle-tested, handles edge cases like nested encoding, and is the industry standard for HTML sanitization. With `ALLOWED_TAGS: []`, it strips everything to plain text.

**Registration order in `index.ts`:**

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(sanitizeMiddleware); // After body parsing, before routes
```

### 2. CORS configuration — whitelist-only origins

Update `packages/api/src/middleware/cors.ts`:

```typescript
import cors from 'cors';

/**
 * Production CORS: only allow requests from explicitly whitelisted origins.
 * Dev CORS: allow localhost origins for development convenience.
 */
export function createCorsMiddleware() {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [];

  // In development, also allow common localhost ports
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:5173', // Vite dev server
    );
  }

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  });
}
```

**Key decisions:**

- No wildcard (`*`) in production — every allowed origin is explicit
- `credentials: true` enables cookie/auth header forwarding
- `maxAge: 86400` reduces preflight requests (browsers cache the result for 24h)
- Server-to-server requests (no `Origin` header) are allowed for webhook and API key access

### 3. Rate limiting verification

Verify that all public endpoints have rate limits. Update `packages/api/src/middleware/rate-limit.ts`:

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis';

/**
 * Rate limit tiers. Each tier is applied to specific route groups.
 */

// General API: 100 requests per 15 minutes per IP
export const generalLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  message: { error: 'Too many requests, please try again later' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Auth/API key endpoints: 10 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts' },
  keyGenerator: (req) => req.ip || 'unknown',
});

// Webhook ingestion: 30 requests per minute per API key
export const webhookLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) }),
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded' },
  keyGenerator: (req) => (req.headers['x-api-key'] as string) || req.ip || 'unknown',
});

// AI synthesis: 5 requests per hour per project (expensive operation)
export const synthesisLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args: string[]) => redis.call(...args) }),
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Synthesis rate limit exceeded. Try again later.' },
  keyGenerator: (req) => `synthesis:${req.params.projectId || req.ip}`,
});
```

**Route registration checklist:**

| Route Group                 | Limiter            | Verified |
| --------------------------- | ------------------ | -------- |
| `GET /api/feedback`         | `generalLimiter`   |          |
| `POST /api/feedback`        | `generalLimiter`   |          |
| `POST /api/feedback/import` | `webhookLimiter`   |          |
| `POST /api/webhook/*`       | `webhookLimiter`   |          |
| `GET /api/themes`           | `generalLimiter`   |          |
| `POST /api/synthesis/run`   | `synthesisLimiter` |          |
| `GET /api/proposals`        | `generalLimiter`   |          |
| `POST /api/api-keys`        | `authLimiter`      |          |
| `GET /api/settings`         | `generalLimiter`   |          |

### 4. API key security — hashed storage and timing-safe comparison

Create `packages/api/src/lib/api-key.ts`:

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const HASH_SECRET = process.env.API_KEY_HASH_SECRET;

if (!HASH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('API_KEY_HASH_SECRET is required in production');
}

/**
 * Hash an API key for storage.
 * Uses HMAC-SHA256 with a server-side secret so that even if the database
 * is compromised, the raw API keys cannot be recovered.
 */
export function hashApiKey(rawKey: string): string {
  return createHmac('sha256', HASH_SECRET || 'dev-secret')
    .update(rawKey)
    .digest('hex');
}

/**
 * Compare a raw API key against a stored hash using timing-safe comparison.
 * This prevents timing attacks where an attacker measures response time
 * to guess the key character by character.
 */
export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(rawKey);

  // Both strings must be same length for timingSafeEqual
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Generate a new API key with a recognizable prefix.
 * Format: sk_live_<32 random hex chars>
 */
export function generateApiKey(): string {
  const { randomBytes } = require('crypto');
  const random = randomBytes(32).toString('hex');
  return `sk_live_${random}`;
}
```

**Why HMAC instead of bcrypt:** API keys are high-entropy random strings (not human passwords), so they do not need bcrypt's salt and cost factor. HMAC-SHA256 is deterministic (needed for lookup), fast, and cryptographically secure for this use case.

**Why timing-safe comparison:** Even though the keys are hashed, timing differences in string comparison could leak information about the hash prefix. `timingSafeEqual` ensures constant-time comparison regardless of where the strings differ.

### 5. SQL injection prevention — Prisma parameterization audit

Prisma's query builder uses parameterized queries by default, which prevents SQL injection. However, we must audit for any use of `$queryRaw` or `$executeRaw` that might interpolate user input:

```bash
# Search for raw SQL usage in the codebase
grep -rn '\$queryRaw\|\$executeRaw\|\$queryRawUnsafe\|\$executeRawUnsafe' packages/api/src/
```

**Rules:**

- `$queryRawUnsafe` and `$executeRawUnsafe` must NEVER be used with user input
- `$queryRaw` with tagged template literals IS safe (Prisma parameterizes them)
- Any `$queryRaw` call must use tagged templates, never string concatenation

Safe:

```typescript
// Tagged template — Prisma parameterizes $1 automatically
const result = await prisma.$queryRaw`
  SELECT * FROM "Feedback" WHERE "projectId" = ${projectId}
`;
```

Unsafe (must be refactored):

```typescript
// String concatenation — SQL injection vulnerability!
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM "Feedback" WHERE "projectId" = '${projectId}'`,
);
```

### 6. Content Security Policy headers via Helmet

Create `packages/api/src/middleware/security-headers.ts`:

```typescript
import helmet from 'helmet';

/**
 * Security headers configuration.
 * Helmet sets sensible defaults; we customize CSP for our needs.
 */
export const securityHeaders = helmet({
  // Content Security Policy: restrict what resources the browser can load
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind uses inline styles
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", process.env.CORS_ORIGIN || 'http://localhost:3000'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },

  // Prevent clickjacking
  frameguard: { action: 'deny' },

  // Prevent MIME type sniffing
  noSniff: true,

  // Control Referrer header
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // HTTP Strict Transport Security (only in production with HTTPS)
  hsts:
    process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // Prevent XSS filter bypass (legacy, but doesn't hurt)
  xssFilter: true,
});
```

**CSP decisions:**

- `'unsafe-inline'` for styles: Required because Tailwind CSS generates inline styles. This is a known trade-off — Tailwind's utility classes are injected at build time, not from user input.
- No `'unsafe-eval'` anywhere: React does not require `eval()`. If a third-party library needs it, we must find an alternative.
- `connectSrc` restricts API calls to our own origin, preventing exfiltration of data to third-party domains.

### 7. Dependency vulnerability scan

```bash
# Run npm audit to find known vulnerabilities
npm audit

# Focus on critical and high severity
npm audit --audit-level=high

# Auto-fix where possible
npm audit fix

# If auto-fix introduces breaking changes, manually review:
npm audit fix --dry-run
```

**Triage process for each vulnerability:**

| Severity | Action                                                 | Timeline       |
| -------- | ------------------------------------------------------ | -------------- |
| Critical | Fix immediately or remove dependency                   | Before launch  |
| High     | Fix or document accepted risk with justification       | Before launch  |
| Moderate | Fix if possible, defer if no exploit path in our usage | Post-launch OK |
| Low      | Document only                                          | Post-launch OK |

**Common fixes:**

- Outdated transitive dependency: `npm update <parent-package>`
- Vulnerable direct dependency: upgrade to patched version or switch to alternative
- No fix available: check if the vulnerability applies to our usage (e.g., a server-side package with a browser-only vulnerability is not exploitable)

### 8. File upload security

Update feedback import endpoint to validate file content, not just extension:

```typescript
import { fileTypeFromBuffer } from 'file-type';

// Allowed MIME types for feedback import
const ALLOWED_TYPES = new Set(['text/csv', 'application/json', 'text/plain']);

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validate uploaded file by reading magic bytes, not trusting the extension.
 * An attacker could rename malware.exe to data.csv — this catches that.
 */
async function validateUpload(buffer: Buffer, declaredMimeType: string): void {
  // Check file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new AppError(413, 'File too large. Maximum size is 10MB.');
  }

  // Detect actual file type from magic bytes
  const detected = await fileTypeFromBuffer(buffer);

  // CSV and JSON files may not have magic bytes (they're plain text)
  // In that case, fileTypeFromBuffer returns undefined — that's OK
  if (detected && !ALLOWED_TYPES.has(detected.mime)) {
    throw new AppError(
      415,
      `Unsupported file type: ${detected.mime}. Allowed: CSV, JSON, plain text.`,
    );
  }

  // Additional check: try parsing as JSON or CSV to verify content
  const content = buffer.toString('utf-8');

  if (declaredMimeType === 'application/json') {
    try {
      JSON.parse(content);
    } catch {
      throw new AppError(400, 'File content is not valid JSON');
    }
  }

  if (declaredMimeType === 'text/csv') {
    // Basic CSV validation: check for at least one comma or newline
    if (!content.includes(',') && !content.includes('\n')) {
      throw new AppError(400, 'File content does not appear to be valid CSV');
    }
  }
}
```

Install dependency:

```bash
npm install file-type --workspace=packages/api
```

### 9. HTTPS enforcement in production

Create `packages/api/src/middleware/https-redirect.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express';

/**
 * Redirect HTTP to HTTPS in production.
 * Checks X-Forwarded-Proto header (set by reverse proxies like nginx, AWS ALB).
 *
 * Only active when NODE_ENV=production. In development, HTTP is fine.
 */
export function httpsRedirect(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Trust the X-Forwarded-Proto header from reverse proxy
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http') {
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
}
```

Register early in middleware chain:

```typescript
// In packages/api/src/index.ts
app.set('trust proxy', 1); // Trust first proxy (nginx/ALB)
app.use(httpsRedirect);
```

**Note:** ShipScope's Docker setup does not include TLS termination — that is handled by an external reverse proxy (nginx, Caddy, AWS ALB, etc.). This middleware redirects if the proxy reports HTTP, but does not handle certificates itself.

### 10. Environment variable security

Audit `packages/api/src/lib/logger.ts` and all logging calls to ensure secrets are never logged:

```typescript
// Sensitive keys that must NEVER appear in logs
const REDACT_KEYS = new Set([
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'OPENAI_API_KEY',
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'API_KEY_HASH_SECRET',
]);

/**
 * Redact sensitive fields from an object before logging.
 * Replaces values of sensitive keys with '[REDACTED]'.
 */
export function redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_KEYS.has(key) || REDACT_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSecrets(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
```

**Additional environment variable rules:**

- Never return `process.env` or config objects in API responses
- Health endpoint must NOT include database URLs, API keys, or connection strings
- Error responses must NOT include stack traces in production (only in development)

Verify with:

```bash
# Search for potential secret leaks in API responses
grep -rn 'process\.env' packages/api/src/routes/
grep -rn 'res\.json.*process\.env' packages/api/src/
grep -rn 'console\.log.*password\|console\.log.*secret\|console\.log.*key' packages/api/src/
```

### 11. Security integration tests

Create `packages/api/src/__tests__/security.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index';

describe('Security', () => {
  describe('XSS Prevention', () => {
    it('should strip HTML tags from feedback content', async () => {
      const res = await request(app).post('/api/feedback').send({
        content: '<script>alert("xss")</script>Normal text',
        source: 'manual',
      });

      expect(res.body.content).not.toContain('<script>');
      expect(res.body.content).toContain('Normal text');
    });
  });

  describe('CORS', () => {
    it('should reject requests from non-whitelisted origins', async () => {
      const res = await request(app).get('/api/health').set('Origin', 'https://evil-site.com');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow requests from whitelisted origins', async () => {
      const res = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Security Headers', () => {
    it('should include CSP header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should include X-Frame-Options', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('should not expose X-Powered-By', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
      // Send requests until rate limited
      const requests = Array.from({ length: 105 }, () => request(app).get('/api/health'));
      const responses = await Promise.all(requests);
      const tooMany = responses.filter((r) => r.status === 429);
      expect(tooMany.length).toBeGreaterThan(0);
    });

    it('should include RateLimit headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('API Key Security', () => {
    it('should use timing-safe comparison for API keys', async () => {
      // Timing test: wrong key should take similar time as partially-correct key
      const start1 = Date.now();
      await request(app)
        .post('/api/webhook/feedback')
        .set('X-API-Key', 'sk_live_completely_wrong_key');
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app)
        .post('/api/webhook/feedback')
        .set('X-API-Key', 'sk_live_partially_correct_prefix_but_wrong');
      const time2 = Date.now() - start2;

      // Times should be within 50ms of each other (timing-safe)
      expect(Math.abs(time1 - time2)).toBeLessThan(50);
    });
  });

  describe('Error Responses', () => {
    it('should not include stack traces in production error responses', async () => {
      const res = await request(app).get('/api/nonexistent-route');
      expect(res.body.stack).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('at Object');
    });

    it('should not expose environment variables in any response', async () => {
      const res = await request(app).get('/api/health');
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('OPENAI_API_KEY');
      expect(body).not.toContain('POSTGRES_PASSWORD');
      expect(body).not.toContain('sk-');
    });
  });
});
```

## Acceptance Criteria

- [ ] All string inputs are sanitized via DOMPurify before reaching route handlers
- [ ] `<script>` tags in feedback content are stripped (verified by test)
- [ ] CORS rejects requests from non-whitelisted origins (verified by test)
- [ ] CORS allows requests from configured `CORS_ORIGIN` (verified by test)
- [ ] All public endpoints have rate limiting applied (checklist in sub-task 3 completed)
- [ ] Rate limit returns 429 with `RateLimit-*` headers (verified by test)
- [ ] API keys stored as HMAC-SHA256 hashes in database, never plaintext
- [ ] API key verification uses `timingSafeEqual` (verified by code review)
- [ ] No `$queryRawUnsafe` or `$executeRawUnsafe` with user input in codebase
- [ ] All `$queryRaw` calls use tagged template literals for parameterization
- [ ] Content-Security-Policy header present on all API responses
- [ ] `X-Powered-By` header removed (verified by test)
- [ ] `X-Frame-Options: DENY` present (verified by test)
- [ ] `npm audit` reports zero critical and zero high vulnerabilities
- [ ] File uploads validated by content type (magic bytes), not just file extension
- [ ] File upload size limited to 10MB
- [ ] HTTPS redirect active when `NODE_ENV=production` and `X-Forwarded-Proto: http`
- [ ] No `process.env` secrets appear in any API response body
- [ ] No secrets logged to stdout/stderr (verified by grep audit)
- [ ] Error responses exclude stack traces in production mode
- [ ] All security tests pass in `security.test.ts`

## Complexity Estimate

**M (Medium)** — Most security measures are standard middleware configurations. The main complexity is in thorough auditing (every endpoint, every query, every log statement) and writing integration tests that verify each defense actually works.

## Risk Factors & Mitigations

| Risk                                                                                               | Impact                            | Mitigation                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| DOMPurify strips legitimate content (e.g., angle brackets in feedback like "I want feature A > B") | Medium — user data corrupted      | Test sanitization with realistic feedback content; DOMPurify preserves `&gt;` entities which render as `>` in the UI         |
| CSP blocks legitimate resources (fonts, API calls)                                                 | High — app breaks in production   | Test CSP in staging; use `Content-Security-Policy-Report-Only` header first to monitor violations without blocking           |
| Rate limiting too aggressive for power users                                                       | Medium — legitimate users blocked | Tiered limits (general: 100/15min, webhook: 30/min, synthesis: 5/hr); configurable via env vars                              |
| timing-safe comparison overhead                                                                    | Low — negligible (microseconds)   | `timingSafeEqual` is a Node.js built-in, highly optimized; no measurable impact                                              |
| npm audit false positives in dev dependencies                                                      | Low — developer confusion         | Focus on `--omit=dev` audit for production; document accepted dev-only risks                                                 |
| file-type package fails to detect CSV/JSON (no magic bytes)                                        | Medium — rejects valid uploads    | Fall back to content parsing validation when magic bytes are absent; only reject when detected type is explicitly disallowed |
| HTTPS redirect loop with misconfigured proxy                                                       | High — app inaccessible           | Only redirect when `X-Forwarded-Proto` is explicitly `http`; require `trust proxy` setting; document proxy requirements      |
| Helmet defaults conflict with development workflow                                                 | Low — dev inconvenience           | Disable HSTS and upgrade-insecure-requests in non-production environments                                                    |

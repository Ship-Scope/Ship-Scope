# 05 — Frontend Scaffold

## Objective

Build the complete frontend application shell with Vite, React, TypeScript, Tailwind CSS (configured with the full design system), layout components (Shell, Sidebar, Topbar, PageContainer), React Router with all 6 routes, Axios API client, React Query provider, and placeholder page components. After this task, the UI is fully navigable with a professional dark theme.

## Dependencies

- 01-monorepo-tooling (ESLint, TypeScript)
- 02-core-shared-package (shared types for API client typing)
- 04-backend-foundation (API running for development)

## Files to Create

| File                                                   | Purpose                                              |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `packages/web/index.html`                              | HTML entry point with font imports                   |
| `packages/web/vite.config.ts`                          | Vite configuration with proxy to API                 |
| `packages/web/tailwind.config.ts`                      | Tailwind with full design system                     |
| `packages/web/postcss.config.cjs`                      | PostCSS with Tailwind and autoprefixer               |
| `packages/web/tsconfig.json`                           | Web TypeScript config                                |
| `packages/web/src/main.tsx`                            | React entry point with providers                     |
| `packages/web/src/App.tsx`                             | Root component with React Router                     |
| `packages/web/src/styles/globals.css`                  | Tailwind directives + custom CSS + animations        |
| `packages/web/src/lib/api.ts`                          | Axios instance with typed API functions              |
| `packages/web/src/lib/constants.ts`                    | App-wide constants                                   |
| `packages/web/src/lib/utils.ts`                        | Utility functions (cn, formatDate, truncate, etc.)   |
| `packages/web/src/components/ui/Button.tsx`            | Button component (primary, secondary, ghost, danger) |
| `packages/web/src/components/ui/Input.tsx`             | Input component with label and error state           |
| `packages/web/src/components/ui/Card.tsx`              | Card container component                             |
| `packages/web/src/components/ui/Badge.tsx`             | Badge/tag component with color variants              |
| `packages/web/src/components/ui/Modal.tsx`             | Modal overlay component                              |
| `packages/web/src/components/ui/Skeleton.tsx`          | Skeleton loader for loading states                   |
| `packages/web/src/components/ui/Toast.tsx`             | Toast notification component + context               |
| `packages/web/src/components/ui/Table.tsx`             | Table component with header/row/cell primitives      |
| `packages/web/src/components/ui/EmptyState.tsx`        | Empty state with icon, title, description, action    |
| `packages/web/src/components/layout/Shell.tsx`         | App shell wrapping Sidebar + main content            |
| `packages/web/src/components/layout/Sidebar.tsx`       | 240px fixed sidebar with navigation                  |
| `packages/web/src/components/layout/Topbar.tsx`        | Page title + action buttons bar                      |
| `packages/web/src/components/layout/PageContainer.tsx` | Scrollable content wrapper                           |
| `packages/web/src/pages/DashboardPage.tsx`             | Dashboard placeholder                                |
| `packages/web/src/pages/FeedbackPage.tsx`              | Feedback placeholder                                 |
| `packages/web/src/pages/ThemesPage.tsx`                | Themes placeholder                                   |
| `packages/web/src/pages/ProposalsPage.tsx`             | Proposals placeholder                                |
| `packages/web/src/pages/SpecsPage.tsx`                 | Specs placeholder                                    |
| `packages/web/src/pages/SettingsPage.tsx`              | Settings placeholder                                 |
| `packages/web/src/hooks/useToast.ts`                   | Toast notification hook                              |

## Files to Modify

| File                        | Changes                         |
| --------------------------- | ------------------------------- |
| `packages/web/package.json` | Verify all dependencies present |

## Detailed Sub-Tasks

### 1. Create `index.html`

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShipScope</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body class="bg-[#07080A] text-[#E8ECF1] antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 2. Configure Vite (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shipscope/core': path.resolve(__dirname, '../core/src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

### 3. Configure Tailwind with full design system (`tailwind.config.ts`)

Encode the entire color palette from product-plan.md Section 4.2:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#07080A',
          surface: '#0D0F12',
          'surface-2': '#13161B',
          'surface-3': '#191D24',
        },
        border: {
          DEFAULT: '#1C2028',
          hover: '#2A303C',
          active: '#3B82F6',
        },
        text: {
          primary: '#E8ECF1',
          secondary: '#8B95A5',
          muted: '#5A6478',
          inverse: '#07080A',
        },
        accent: {
          blue: '#3B82F6',
          'blue-hover': '#2563EB',
          'blue-dim': 'rgba(59,130,246,0.125)',
          indigo: '#818CF8',
          purple: '#C084FC',
        },
        success: { DEFAULT: '#34D399', dim: 'rgba(52,211,153,0.125)' },
        warning: { DEFAULT: '#FBBF24', dim: 'rgba(251,191,36,0.125)' },
        danger: { DEFAULT: '#FB7185', dim: 'rgba(251,113,133,0.125)' },
        info: '#38BDF8',
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.3)',
        md: '0 4px 12px rgba(0,0,0,0.4)',
        lg: '0 12px 40px rgba(0,0,0,0.5)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease-out',
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 4. Create globals.css with custom styles

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-bg-primary text-text-primary font-sans;
  }
  ::selection {
    @apply bg-accent-blue/30 text-text-primary;
  }
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    @apply bg-transparent;
  }
  ::-webkit-scrollbar-thumb {
    @apply bg-border rounded-full hover:bg-border-hover;
  }
}
```

### 5. Create utility functions (`lib/utils.ts`)

```typescript
import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }
export function truncate(str: string, len: number) { ... }
export function formatDate(date: string) { ... }
export function formatNumber(num: number) { ... }
export function getSentimentColor(score: number) { ... }
export function getUrgencyColor(score: number) { ... }
```

### 6. Create API client (`lib/api.ts`)

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Typed API functions for each endpoint
export const feedbackApi = {
  list: (params) => api.get('/feedback', { params }),
  get: (id) => api.get(`/feedback/${id}`),
  create: (data) => api.post('/feedback', data),
  // ... etc
};
```

### 7. Build layout components

**Shell.tsx** — Flex container: Sidebar (fixed 240px) + main content area (flex-1). Handles responsive breakpoints (sidebar collapses to icons at 768px).

**Sidebar.tsx:**

- Logo/brand at top ("ShipScope" in DM Sans semibold)
- Navigation items with lucide-react icons:
  - `BarChart3` Dashboard
  - `MessageSquare` Feedback
  - `Brain` Themes
  - `Lightbulb` Proposals
  - `FileText` Specs
  - `Settings` Settings (at bottom, separated)
- Active state: `bg-accent-blue-dim text-accent-blue`
- Hover state: `bg-bg-surface-2 text-text-primary`
- Bottom section: Feedback count status, AI connection status indicator

**Topbar.tsx:**

- Takes `title` and `actions` (ReactNode) as props
- Left: Page title (text-2xl font-semibold)
- Right: Action buttons slot

**PageContainer.tsx:**

- Scrollable content area with consistent padding
- `max-w-[1400px] mx-auto px-6 py-6`

### 8. Build base UI components

Each follows the style guide from Section 4.4:

**Button** — 4 variants (primary, secondary, ghost, danger) with sizes (sm, md, lg), loading state (spinner), disabled state. Use `cn()` for class merging.

**Input** — Styled input with optional label, helper text, error message. Focus ring: `border-accent-blue ring-1 ring-accent-blue`.

**Card** — Container with `bg-bg-surface border border-border rounded-xl p-5` and optional hover effect.

**Badge** — Small tag with color variants (blue, green, yellow, red, gray). Used for scores, status, categories.

**Modal** — Overlay backdrop + centered panel. Close on Escape key and backdrop click. Focus trap. Smooth fade transition.

**Skeleton** — Animated shimmer loading placeholder. Variants: text (single line), block (rectangle), circle.

**Toast** — Notification component with success/error/info variants. Auto-dismiss after 5s. Stack multiple toasts. Context provider + `useToast()` hook.

**Table** — Composable table with `<TableHeader>`, `<TableRow>`, `<TableCell>` subcomponents. Styled per Section 4.4 tables spec.

**EmptyState** — Centered layout with icon, title, description, and optional action button.

### 9. Set up React Router with all 6 routes

```tsx
// App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Shell } from './components/layout/Shell';

export function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/themes" element={<ThemesPage />} />
          <Route path="/proposals" element={<ProposalsPage />} />
          <Route path="/specs" element={<SpecsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}
```

### 10. Set up React Query provider

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s stale time
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

### 11. Create placeholder page components

Each page should render:

- `<Topbar title="Page Name" actions={<Button>Primary Action</Button>} />`
- `<PageContainer>`
- An `<EmptyState>` with appropriate icon and message
- Example: FeedbackPage shows "No feedback yet" with Upload icon and "Import your first feedback" action

### 12. Verify everything works

- `npm run dev` in web package starts Vite dev server at :3000
- All 6 routes are navigable via sidebar
- Active route is highlighted in sidebar
- Tailwind classes render correctly (dark theme, correct colors)
- API proxy works (browser at :3000 can reach :4000/api/health)
- No TypeScript or ESLint errors
- Responsive: sidebar collapses at 768px breakpoint

## Acceptance Criteria

- [ ] `npm run dev` starts frontend at http://localhost:3000
- [ ] Dark theme renders with correct colors (bg #07080A, text #E8ECF1)
- [ ] DM Sans font loads and renders for all UI text
- [ ] JetBrains Mono loads for code/data elements
- [ ] Sidebar shows all 6 navigation items with correct icons
- [ ] Clicking sidebar items navigates to correct route
- [ ] Active route highlighted with blue accent color
- [ ] All UI components (Button, Input, Card, Badge, Modal, Skeleton, Toast, Table, EmptyState) render correctly
- [ ] Button has all 4 variants visually distinct
- [ ] Modal opens/closes with keyboard (Escape) and backdrop click
- [ ] Toast notifications appear and auto-dismiss
- [ ] Responsive: sidebar collapses to icon-only at <1280px
- [ ] Responsive: bottom navigation at <768px
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] API proxy forwards /api/\* requests to backend

## Complexity Estimate

**XL (Extra Large)** — Most file-intensive task. 30+ files to create. Must establish UI patterns that all feature pages will follow. Design system implementation must be pixel-precise.

## Risk Factors & Mitigations

| Risk                                          | Impact                                      | Mitigation                                                                                                  |
| --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tailwind config doesn't match design spec     | High — visual inconsistency                 | Cross-reference every color/spacing value against Section 4.2; create a visual test page showing all tokens |
| Font loading FOUC (flash of unstyled content) | Medium — poor first impression              | Use `font-display: swap` and preconnect hints; include system font fallbacks                                |
| Vite proxy not forwarding correctly           | Medium — API calls fail in dev              | Test proxy with `/api/health` immediately; ensure no trailing slash issues                                  |
| Component API design regret                   | Medium — refactoring later is expensive     | Follow established patterns (Radix-style API with composable parts); keep components minimal                |
| React Router v6 breaking changes              | Low — API is stable                         | Pin exact version in package.json                                                                           |
| Tailwind purging removes needed classes       | Medium — styles missing in production build | Use complete class names (never construct dynamically like `bg-${color}`); test production build            |

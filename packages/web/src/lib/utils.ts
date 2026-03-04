import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

export function getSentimentColor(score: number | null): string {
  if (score === null) return 'text-text-muted';
  if (score > 0.3) return 'text-success';
  if (score < -0.3) return 'text-danger';
  return 'text-warning';
}

export function getUrgencyColor(score: number | null): string {
  if (score === null) return 'text-text-muted';
  if (score > 0.7) return 'text-danger';
  if (score > 0.4) return 'text-warning';
  return 'text-success';
}

interface ShipScopeLogoProps {
  size?: number;
  className?: string;
}

export function ShipScopeLogo({ size = 24, className }: ShipScopeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ss-logo-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#C084FC" />
        </linearGradient>
      </defs>
      <circle cx="256" cy="256" r="200" stroke="url(#ss-logo-g)" strokeWidth="28" fill="none" />
      <line
        x1="256"
        y1="16"
        x2="256"
        y2="80"
        stroke="url(#ss-logo-g)"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <line
        x1="256"
        y1="432"
        x2="256"
        y2="496"
        stroke="url(#ss-logo-g)"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="256"
        x2="80"
        y2="256"
        stroke="url(#ss-logo-g)"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <line
        x1="432"
        y1="256"
        x2="496"
        y2="256"
        stroke="url(#ss-logo-g)"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <polyline
        points="468,228 496,256 468,284"
        stroke="url(#ss-logo-g)"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="256" cy="256" r="22" fill="url(#ss-logo-g)" />
    </svg>
  );
}

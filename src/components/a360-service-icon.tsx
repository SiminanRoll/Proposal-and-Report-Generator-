import type { A360ServiceKey } from "@/lib/prospects/a360-service-coverage";

/** Local outline artwork matches the presentation's existing 24px icon language. */
export function A360ServiceIcon({ service }: { service: A360ServiceKey | "software" }) {
  const accent = "prospect-service-icon-accent";
  const glyphs = {
    workstations: <>
      <rect x="3" y="3.5" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 16.5V21" />
      <path className={accent} pathLength="1" d="M6 10h3l2-3 3 6 2-3h2" />
    </>,
    network: <>
      <rect x="9" y="2" width="6" height="5" rx="1.2" />
      <rect x="2" y="17" width="6" height="5" rx="1.2" />
      <rect x="16" y="17" width="6" height="5" rx="1.2" />
      <path className={accent} pathLength="1" d="M12 7v5M5 17v-5h14v5" />
    </>,
    security: <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
      <path className={accent} pathLength="1" d="m8.5 12 2.5 2.5 4.5-4.5" />
    </>,
    support: <>
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
      <rect x="3" y="11" width="4" height="7" rx="1.5" />
      <rect x="17" y="11" width="4" height="7" rx="1.5" />
      <path className={accent} pathLength="1" d="M19 18v1a2 2 0 0 1-2 2h-5" />
    </>,
    server: <>
      <rect x="3" y="3" width="18" height="7" rx="2" />
      <path d="M11 14H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h5M7 6.5h.01M7 17.5h.01M16 6.5h2" />
      <path className={accent} pathLength="1" d="M13.5 16a4 4 0 1 1 0 4M13 13v4h4" />
    </>,
    guidance: <>
      <circle cx="12" cy="12" r="9" />
      <path className={accent} pathLength="1" d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
    </>,
    software: <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
      <path className={accent} pathLength="1" d="m9 12-3 2.5L9 17m6-5 3 2.5-3 2.5M13 12l-2 5" />
    </>,
  };

  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{glyphs[service]}</svg>;
}

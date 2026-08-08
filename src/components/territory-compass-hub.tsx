import type { CSSProperties } from "react";

type TerritoryCompassHubProps = {
  bearing?: number;
  active?: boolean;
  accentColor?: string;
  title?: string;
};

export function TerritoryCompassHub({ bearing = 0, active = true, accentColor = "#67d8ff", title = "Client Compass direction" }: TerritoryCompassHubProps) {
  return <g className={`territory-compass-hub${active ? " is-active" : " is-idle"}`} aria-hidden="true">
    <title>{title}</title>
    <circle className="territory-compass-glass" cx="104" cy="104" r="50" />
    <circle className="territory-compass-drift" cx="104" cy="104" r="45" />
    <circle className="territory-compass-ring" cx="104" cy="104" r="48" />
    <g className="territory-compass-cardinals">
      <text x="104" y="66" textAnchor="middle">N</text>
      <text x="142" y="107" textAnchor="middle">E</text>
      <text x="104" y="146" textAnchor="middle">S</text>
      <text x="66" y="107" textAnchor="middle">W</text>
    </g>
    <g className="territory-compass-ticks">
      <line x1="104" y1="57" x2="104" y2="62" /><line x1="151" y1="104" x2="146" y2="104" />
      <line x1="104" y1="151" x2="104" y2="146" /><line x1="57" y1="104" x2="62" y2="104" />
    </g>
    <g className="territory-compass-needle" style={{ "--compass-bearing": `${bearing}deg`, "--compass-accent": accentColor } as CSSProperties}>
      <path className="territory-compass-needle-tip" d="M104 103 L99.5 76 L104 66 L108.5 76 Z" />
      <path className="territory-compass-needle-tail" d="M104 105 L99.9 129 L104 138 L108.1 129 Z" />
      <circle className="territory-compass-pin" cx="104" cy="104" r="4" />
    </g>
    <circle className="territory-compass-center" cx="104" cy="104" r="31" />
    <ellipse className="territory-compass-center-sheen" cx="96" cy="91" rx="19" ry="10" />
  </g>;
}

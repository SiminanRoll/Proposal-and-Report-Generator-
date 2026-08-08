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
    <circle className="territory-compass-bezel" cx="104" cy="104" r="52" />
    <circle className="territory-compass-glass" cx="104" cy="104" r="49" />
    <circle className="territory-compass-drift" cx="104" cy="104" r="45" />
    <circle className="territory-compass-ring" cx="104" cy="104" r="47" />
    <g className="territory-compass-rose">
      <line x1="104" y1="61" x2="104" y2="147" />
      <line x1="61" y1="104" x2="147" y2="104" />
      <line x1="73.5" y1="73.5" x2="134.5" y2="134.5" />
      <line x1="134.5" y1="73.5" x2="73.5" y2="134.5" />
    </g>
    <g className="territory-compass-cardinals">
      <text className="is-north" x="104" y="65" textAnchor="middle">N</text>
      <text x="143" y="107" textAnchor="middle">E</text>
      <text x="104" y="147" textAnchor="middle">S</text>
      <text x="65" y="107" textAnchor="middle">W</text>
    </g>
    <g className="territory-compass-ticks">
      <line x1="104" y1="55" x2="104" y2="62" /><line x1="153" y1="104" x2="146" y2="104" />
      <line x1="104" y1="153" x2="104" y2="146" /><line x1="55" y1="104" x2="62" y2="104" />
      <line x1="69.5" y1="69.5" x2="74" y2="74" /><line x1="138.5" y1="69.5" x2="134" y2="74" />
      <line x1="138.5" y1="138.5" x2="134" y2="134" /><line x1="69.5" y1="138.5" x2="74" y2="134" />
    </g>
    <g className="territory-compass-needle" style={{ "--compass-bearing": `${bearing}deg`, "--compass-accent": accentColor } as CSSProperties}>
      <path className="territory-compass-needle-tail" d="M104 149 L96.8 104 L104 108.5 L111.2 104 Z" />
      <path className="territory-compass-needle-tip" d="M104 56 L111.2 104 L104 99.5 L96.8 104 Z" />
      <path className="territory-compass-needle-highlight" d="M104 61 L104 97.5" />
      <circle className="territory-compass-pin-ring" cx="104" cy="104" r="6.1" />
      <circle className="territory-compass-pin" cx="104" cy="104" r="3.5" />
    </g>
    <circle className="territory-compass-center" cx="104" cy="104" r="31" />
    <ellipse className="territory-compass-center-sheen" cx="96" cy="91" rx="19" ry="10" />
  </g>;
}

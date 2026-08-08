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
    <defs>
      <linearGradient id="territoryCompassTipMetal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#e9fbff" stopOpacity=".96" />
        <stop offset="18%" stopColor={accentColor} stopOpacity=".94" />
        <stop offset="48%" stopColor={accentColor} stopOpacity="1" />
        <stop offset="72%" stopColor="#87dcff" stopOpacity=".98" />
        <stop offset="100%" stopColor="#f4fdff" stopOpacity=".91" />
      </linearGradient>
      <linearGradient id="territoryCompassTipDarkMetal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#1e719f" stopOpacity=".28" />
        <stop offset="48%" stopColor="#0f547d" stopOpacity=".10" />
        <stop offset="100%" stopColor="#d7f5ff" stopOpacity=".30" />
      </linearGradient>
      <linearGradient id="territoryCompassTailMetal" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#6f8799" stopOpacity=".30" />
        <stop offset="46%" stopColor="#f4f9fc" stopOpacity=".64" />
        <stop offset="100%" stopColor="#71899b" stopOpacity=".28" />
      </linearGradient>
      <linearGradient id="territoryCompassBezelMetal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#bfe8fb" stopOpacity=".20" />
        <stop offset="32%" stopColor="#244d6b" stopOpacity=".42" />
        <stop offset="68%" stopColor="#0c2f4b" stopOpacity=".60" />
        <stop offset="100%" stopColor="#a5d9f2" stopOpacity=".17" />
      </linearGradient>
      <radialGradient id="territoryCompassPinMetal" cx="36%" cy="28%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="42%" stopColor="#d9f3ff" />
        <stop offset="76%" stopColor="#6ab9e4" />
        <stop offset="100%" stopColor="#1f638d" />
      </radialGradient>
    </defs>
    <circle className="territory-compass-bezel" cx="104" cy="104" r="52" />
    <circle className="territory-compass-bezel-metal" cx="104" cy="104" r="50.8" />
    <circle className="territory-compass-glass" cx="104" cy="104" r="49" />
    <circle className="territory-compass-drift" cx="104" cy="104" r="45" />
    <circle className="territory-compass-ring" cx="104" cy="104" r="47" />
    <circle className="territory-compass-inner-ring" cx="104" cy="104" r="38.5" />
    <g className="territory-compass-rose">
      <line x1="104" y1="61" x2="104" y2="147" />
      <line x1="61" y1="104" x2="147" y2="104" />
      <line x1="73.5" y1="73.5" x2="134.5" y2="134.5" />
      <line x1="134.5" y1="73.5" x2="73.5" y2="134.5" />
    </g>
    <path className="territory-compass-north-jewel" d="M104 53 L100.8 59.2 L107.2 59.2 Z" />
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
    <g className="territory-compass-minor-ticks">
      <line x1="84" y1="57.5" x2="86.2" y2="62.5" /><line x1="124" y1="57.5" x2="121.8" y2="62.5" />
      <line x1="150.5" y1="84" x2="145.5" y2="86.2" /><line x1="150.5" y1="124" x2="145.5" y2="121.8" />
      <line x1="124" y1="150.5" x2="121.8" y2="145.5" /><line x1="84" y1="150.5" x2="86.2" y2="145.5" />
      <line x1="57.5" y1="124" x2="62.5" y2="121.8" /><line x1="57.5" y1="84" x2="62.5" y2="86.2" />
    </g>
    <g className="territory-compass-needle" style={{ "--compass-bearing": `${bearing}deg`, "--compass-accent": accentColor } as CSSProperties}>
      <path className="territory-compass-needle-tail" d="M104 109 L105.9 125.5 L104 146 L102.1 125.5 Z" />
      <path className="territory-compass-tail-highlight" d="M104 112 L104 139" />
      <path className="territory-compass-needle-shadow" d="M104 51 L113 101.5 L104 97 L95 101.5 Z" />
      <path className="territory-compass-needle-tip" d="M104 51 L113 101.5 L104 97 L95 101.5 Z" />
      <path className="territory-compass-needle-face" d="M104 51 L113 101.5 L104 97 Z" />
      <path className="territory-compass-needle-edge" d="M104 51 L95 101.5 L104 97 Z" />
      <path className="territory-compass-needle-highlight" d="M101.8 61 L103.2 94" />
      <path className="territory-compass-needle-spine" d="M104 57 L104 96.5" />
      <circle className="territory-compass-pin-ring" cx="104" cy="104" r="6.4" />
      <circle className="territory-compass-pin" cx="104" cy="104" r="4.25" />
      <circle className="territory-compass-pin-core" cx="102.8" cy="102.6" r="1.45" />
    </g>
  </g>;
}

/** Presentation-only domain descriptions. Skill content always comes from owner-scoped Supabase after authentication. */
export const EVO_DOMAINS = [
  { name: "EVO Core", short: "EVO Core", subtitle: "How the system learns and operates", description: "The execution framework, skill discovery, context routing and learning procedures that help EVO work consistently.", color: "#58dfbf", soft: "#103c37", symbol: "✦" },
  { name: "Advantage Technologies", short: "Advantage", subtitle: "Client success, technology and marketing", description: "Client reviews, workflow engineering, content, technical standards and business outreach with their own operating boundaries.", color: "#67b5ff", soft: "#102e4a", symbol: "A" },
  { name: "Application Development", short: "Development", subtitle: "Products, platforms and engineering", description: "Engineering methods for the applications EVO supports, including safe releases, integrations and system modernization.", color: "#ae9aff", soft: "#2b2448", symbol: "{}" },
  { name: "Personal & Family", short: "Personal", subtitle: "Creative projects and play", description: "Independent personal projects and family games, kept separate from customer and commercial systems.", color: "#edc579", soft: "#41301c", symbol: "★" },
  { name: "Hammy & The Strawberry", short: "Hammy", subtitle: "Stories, community and interactive worlds", description: "Hammy's book, creative identity, social life, outreach and interactive storybook world, with careful account boundaries.", color: "#ff97b2", soft: "#462839", symbol: "♥" },
  { name: "Brittany Myra", short: "Brittany", subtitle: "Jewelry, education and business knowledge", description: "Brittany's independently owned jewelry, teaching and business procedures, with her permissions and private sources respected.", color: "#d4a8fa", soft: "#3a274f", symbol: "◇" },
] as const;

export function domainInfo(name: string) {
  return EVO_DOMAINS.find((domain) => domain.name === name) ?? {
    name, short: name, subtitle: "Independent knowledge domain",
    description: "Browse the registered procedures and safe capability summaries in this domain.",
    color: "#83b8ff", soft: "#1c304a", symbol: "✦",
  };
}

export const ADVANTAGE_WEBSITE_LINKS = {
  home: "https://www.adv-tech.com/",
  a360: "https://www.adv-tech.com/a360/",
  secure: "https://www.adv-tech.com/what-is-hassle-free-it/secure/",
  stable: "https://www.adv-tech.com/what-is-hassle-free-it/stable/",
  supported: "https://www.adv-tech.com/what-is-hassle-free-it/supported/",
  simple: "https://www.adv-tech.com/what-is-hassle-free-it/simple/",
  projects: "https://www.adv-tech.com/projects-upgrades-and-technology-refreshes/",
  techEducation: "https://www.adv-tech.com/tech-education/",
  successStories: "https://www.adv-tech.com/success-stories/",
  contact: "https://www.adv-tech.com/contact-us/",
} as const;

export type AdvantageWebsiteLinkKey = keyof typeof ADVANTAGE_WEBSITE_LINKS;

export function advantageWebsiteUrl(key: AdvantageWebsiteLinkKey): string {
  return ADVANTAGE_WEBSITE_LINKS[key];
}

export function isApprovedAdvantageWebsiteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "adv-tech.com" || url.hostname === "www.adv-tech.com");
  } catch {
    return false;
  }
}

export function a360PriorityWebsiteLinkKeys(priorities: string[], limit = 2): AdvantageWebsiteLinkKey[] {
  const keys: AdvantageWebsiteLinkKey[] = [];
  const add = (key: AdvantageWebsiteLinkKey) => {
    if (!keys.includes(key)) keys.push(key);
  };

  for (const rawPriority of priorities) {
    const priority = rawPriority.toLowerCase();
    if (/reliability|downtime|lifecycle/.test(priority)) add("stable");
    else if (/better support|current it frustration/.test(priority)) add("supported");
    else if (/cyber|hipaa|backup|recovery/.test(priority)) add("secure");
    else if (/predictable cost|budget|simple/.test(priority)) add("simple");
    else if (/aging technology|growth|expansion|faster computer|refresh/.test(priority)) add("projects");
    if (keys.length >= limit) break;
  }

  return keys.slice(0, Math.max(0, limit));
}

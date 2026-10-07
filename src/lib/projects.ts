import { destinations, otherProjects } from './content';

export type HeroKind = 'image' | 'cube' | 'lens' | 'tilted' | 'pipeline';

/** One project page. Destinations and other projects differ a little in content.json; this evens them out. */
export interface Project {
  slug: string;
  /** Short name, as on the map. */
  name: string;
  /** Page heading: the full name where there is one. */
  title: string;
  /** Position on the route, 1 to 7: the three destinations first, then the other projects. */
  position: number;
  /** "Destination" or "Other project": what the badge calls it. */
  kind: string;
  chips: string[];
  description: string;
  highlights: string[];
  awardsLine?: string;
  heroKind: HeroKind;
  heroAlt: string;
  /** Path of the hero image in redesign/, for the kinds that show one. */
  hero?: string;
  facts: [string, string][];
  problemLabel: string;
  problem: string;
  shots: { src: string; caption: string; alt: string; pixelated?: boolean }[];
  stack: string[];
  footnote: string;
  links: [string, string][];
  primary: [string, string];
}

const pair = (p: string[]): [string, string] => [p[0] ?? '', p[1] ?? ''];

export const projects: Project[] = [
  ...destinations.map(
    (d): Project => ({
      slug: d.slug,
      name: d.name,
      title: d.name,
      position: 0,
      kind: 'Destination',
      chips: d.chips,
      description: d.description,
      highlights: d.highlights,
      awardsLine: 'awardsLine' in d ? d.awardsLine : undefined,
      heroKind: d.heroKind as HeroKind,
      heroAlt: d.heroAlt,
      hero: 'hero' in d ? d.hero : undefined,
      facts: d.facts.map(pair),
      problemLabel: d.problemLabel,
      problem: d.problem,
      shots: d.shots,
      stack: d.stack,
      footnote: d.footnote,
      links: d.links.map(pair),
      primary: pair(d.primary),
    }),
  ),
  ...otherProjects.map(
    (o): Project => ({
      slug: o.slug,
      name: o.name,
      title: 'fullName' in o && o.fullName ? o.fullName : o.name,
      position: 0,
      kind: 'Other project',
      chips: [o.tag],
      description: o.description,
      highlights: o.highlights,
      heroKind: o.heroKind as HeroKind,
      heroAlt: o.heroAlt,
      hero: 'hero' in o ? o.hero : undefined,
      facts: o.facts.map(pair),
      problemLabel: o.problemLabel,
      problem: o.problem,
      shots: o.shots,
      stack: o.stack,
      footnote: o.footnote,
      links: [],
      primary: pair(o.primary),
    }),
  ),
];

projects.forEach((project, i) => (project.position = i + 1));

/** The projects before and after one, in route order, wrapping round at both ends. */
export function neighbours(project: Project): { prev: Project; next: Project } {
  const i = projects.indexOf(project);
  const at = (n: number): Project => projects[(n + projects.length) % projects.length]!;
  return { prev: at(i - 1), next: at(i + 1) };
}

/** Split text around the phrases to highlight, in the order they appear. */
export function highlight(text: string, phrases: string[]): { text: string; mark: boolean }[] {
  const parts: { text: string; mark: boolean }[] = [];
  let rest = text;
  while (rest) {
    let at = -1;
    let hit = '';
    for (const phrase of phrases) {
      const i = rest.indexOf(phrase);
      if (i !== -1 && (at === -1 || i < at)) {
        at = i;
        hit = phrase;
      }
    }
    if (at === -1) {
      parts.push({ text: rest, mark: false });
      break;
    }
    if (at > 0) parts.push({ text: rest.slice(0, at), mark: false });
    parts.push({ text: hit, mark: true });
    rest = rest.slice(at + hit.length);
  }
  return parts;
}

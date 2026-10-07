import type { ImageMetadata } from 'astro';
import raw from '../../redesign/content.json';

// redesign/content.json is the single source for every fact, number and link.
export const content = raw;
export const { person, destinations, otherProjects } = raw;

export type Destination = (typeof raw.destinations)[number];
export type OtherProject = (typeof raw.otherProjects)[number];

const images = import.meta.glob<{ default: ImageMetadata }>(
  ['../../redesign/assets/*.{webp,jpg,png}', '!**/cubic-spin48.webp'],
  { eager: true },
);

/** An image from redesign/assets, by its content.json path ("assets/name.webp"). */
export function asset(path: string): ImageMetadata {
  const found = images[`../../redesign/${path}`];
  if (!found) throw new Error(`Image not found in redesign/assets: ${path}`);
  return found.default;
}

export const projectUrl = (slug: string): string => `/projects/${slug}/`;
export const RESUME_URL = '/resume.pdf';
export const PROFILE_URL = '/profile/';

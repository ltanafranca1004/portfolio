import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Serves redesign/assets/resume.pdf at a stable /resume.pdf, so there is one copy in the repo.
export const GET: APIRoute = async () => {
  const file = await readFile(path.join(process.cwd(), 'redesign/assets/resume.pdf'));
  return new Response(new Uint8Array(file), { headers: { 'Content-Type': 'application/pdf' } });
};

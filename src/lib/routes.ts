const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CVE = /^CVE-\d{4}-\d{4,}$/i;

function assertSlug(value: string): string {
  if (!SLUG.test(value)) throw new Error(`Invalid slug: ${value}`);
  return value;
}

export function articlePath(slug: string): string {
  return `/article/${assertSlug(slug)}`;
}

export function editionPath(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid edition date: ${date}`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid edition date: ${date}`);
  }
  return `/${match[1]}/${match[2]}/${match[3]}`;
}

export function cvePath(cve: string): string {
  const normalized = cve.toUpperCase();
  if (!CVE.test(normalized)) throw new Error(`Invalid CVE: ${cve}`);
  return `/cve/${normalized}`;
}

export function categoryPath(category: string): string {
  return `/category/${assertSlug(category)}`;
}

export function tagPath(tag: string): string {
  return `/tag/${assertSlug(tag)}`;
}

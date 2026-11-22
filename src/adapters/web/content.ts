// ContentSource adapter: loads a content pack published next to the page.
import type { CaseDef } from "../../casework/case/model.ts";
import type { Lesson } from "../../kernel/lessons.ts";
import type { SkillId } from "../../kernel/skills.ts";

export interface PackSkill {
  id: SkillId;
  name: string;
  icon: string;
}

export interface Pack {
  id: string;
  version: string;
  skills: PackSkill[];
  lessons: Lesson[];
  cases: CaseDef[];
}

export async function loadPack(base: string): Promise<Pack> {
  const manifest = await getJson(`${base}/manifest.json`);
  const lessons = (await getJson(`${base}/${manifest.lessons}`)) as Lesson[];
  const cases = (await Promise.all(((manifest.cases ?? []) as string[]).map((p) => getJson(`${base}/${p}`)))) as CaseDef[];
  cases.sort((a, b) => a.order - b.order);
  return { id: manifest.id, version: manifest.version, skills: manifest.skills, lessons, cases };
}

async function getJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

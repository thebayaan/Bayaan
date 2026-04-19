import type {Template, TemplateId} from '../types';
import {classicCreamTemplate} from './classicCream';
import {fullBleedCalligraphyTemplate} from './fullBleedCalligraphy';
import {midnightGoldTemplate} from './midnightGold';

export const TEMPLATES: readonly Template[] = [
  classicCreamTemplate,
  midnightGoldTemplate,
  fullBleedCalligraphyTemplate,
];

export function getTemplate(id: TemplateId): Template {
  const t = TEMPLATES.find(x => x.id === id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export const DEFAULT_TEMPLATE_ID: TemplateId = 'classic-cream';

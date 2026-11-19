import { writeFileSync } from 'node:fs';
import catalog from '../data/nyc-catalog-expansion-200.json' with { type: 'json' };
import { buildExpansionSql } from './generate-nyc-expansion.mjs';

writeFileSync(new URL('../migrations/0008_expand_voice_directory_to_200.sql',import.meta.url),buildExpansionSql(catalog));
console.log(`Generated 0008: ${catalog.teachers.length} new instructors; ${catalog.expectedTotal} total public listings.`);

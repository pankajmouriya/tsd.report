import { assertContentMode, getEditions } from '../src/lib/content';

assertContentMode();
const editions = getEditions();
console.log(`Validated ${editions.length} fixture editions and ${editions.reduce((sum, edition) => sum + edition.stories.length, 0)} edition entries.`);

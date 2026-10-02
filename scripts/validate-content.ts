import { assertContentMode, getContentMode, getEditions } from '../src/lib/content';
import { getVulnerabilityWatchSnapshots } from '../src/lib/vulnerability-watch';

assertContentMode();
const editions = getEditions();
const watchSnapshots = getVulnerabilityWatchSnapshots();
console.log(`Validated ${editions.length} ${getContentMode()} editions, ${editions.reduce((sum, edition) => sum + edition.stories.length, 0)} edition entries, and ${watchSnapshots.length} Vulnerability Watch snapshots.`);

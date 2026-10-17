// Validates every configuration group. Prints variable names and reasons, never values.
import { ConfigError, GROUP_NAMES, getConfig } from '../server/config.js';

let failed = false;
for (const group of GROUP_NAMES) {
  try {
    getConfig(group);
    process.stdout.write(`ok       ${group}\n`);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    failed = true;
    process.stdout.write(`missing  ${group}: ${error.problems.join('; ')}\n`);
  }
}
process.exit(failed ? 1 : 0);

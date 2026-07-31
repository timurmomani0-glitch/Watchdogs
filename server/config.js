// Loads the owned-asset registry and jurisdiction profile.
// Prefers the private (gitignored) files; falls back to the committed examples
// so the dashboard runs out of the box in demo/mock mode.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import yaml from 'js-yaml';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CONFIG_DIR = path.join(__dirname, '..', 'config');

function loadYaml(base, forceExample = false) {
  const real = path.join(CONFIG_DIR, `${base}.yaml`);
  const example = path.join(CONFIG_DIR, `${base}.example.yaml`);
  const file = !forceExample && fs.existsSync(real) ? real : example;
  const usingExample = file === example;
  const data = yaml.load(fs.readFileSync(file, 'utf8'));
  return { data, usingExample, file };
}

// forceExample: always load the committed example configs, ignoring any private
// registry. The self-test uses this so `npm run check` proves the GATE LOGIC
// against fixed fixtures — otherwise it would start failing the moment a user
// runs `npm run setup` and replaces the example network with their own.
export function loadConfig({ forceExample = false } = {}) {
  const registry = loadYaml('owned-assets', forceExample);
  const jurisdiction = loadYaml('jurisdiction', forceExample);
  return {
    registry: registry.data,
    jurisdiction: jurisdiction.data,
    demo: registry.usingExample, // example registry => nothing real is owned yet
    sources: {
      registry: path.basename(registry.file),
      jurisdiction: path.basename(jurisdiction.file),
    },
  };
}

#!/usr/bin/env node
// Print the effective scope of YOUR live registry — what ctOS will allow and
// deny right now.  `npm run scope`
//
// `npm run check` proves the gate LOGIC against fixed example fixtures.
// This shows what that logic permits given your actual config/owned-assets.yaml.
import { loadConfig } from '../server/config.js';
import { authorize } from '../server/scope-gate.js';

const E = '\x1b[';
const C = { hi: `${E}97m`, dim: `${E}38;5;245m`, ok: `${E}38;5;150m`,
            warn: `${E}38;5;214m`, red: `${E}38;5;203m`, off: `${E}0m` };
const say = (s = '') => console.log(s);
const rule = () => say(C.dim + '─'.repeat(68) + C.off);

const cfg = loadConfig();
const r = cfg.registry, j = cfg.jurisdiction;

say();
say(`${C.hi}  ctOS effective scope${C.off}`);
rule();

if (cfg.demo) {
  say(`${C.warn}  DEMO MODE — no private registry found.${C.off}`);
  say(`  ${C.dim}Running on config/owned-assets.example.yaml (synthetic data).${C.off}`);
  say(`  ${C.dim}Run ${C.off}${C.hi}npm run setup${C.off}${C.dim} to register your real network.${C.off}`);
  rule();
}

say(`  owner        ${C.hi}${r.owner}${C.off}`);
say(`  jurisdiction ${C.hi}${j.country}/${j.regulator}${C.off}`);
say(`  config       ${C.dim}${cfg.sources.registry} · ${cfg.sources.jurisdiction}${C.off}`);
say();

// ── what is in scope ────────────────────────────────────────────────────────
say(`${C.hi}  IN SCOPE${C.off} ${C.dim}(these will be allowed)${C.off}`);
const nets = r.networks || [];
if (nets.length) nets.forEach((n) => say(`    ${C.ok}✓${C.off} network  ${n.cidr.padEnd(20)} ${C.dim}${n.label || ''}${C.off}`));
else say(`    ${C.dim}— no networks registered —${C.off}`);

const devs = r.devices || [];
const byKind = devs.reduce((a, d) => ((a[d.kind] = (a[d.kind] || 0) + 1), a), {});
if (devs.length) say(`    ${C.ok}✓${C.off} devices  ${devs.length} ${C.dim}(${Object.entries(byKind).map(([k, v]) => `${v} ${k}`).join(', ')})${C.off}`);
if ((r.hosts || []).length) say(`    ${C.ok}✓${C.off} ssh      ${r.hosts.length} host(s) controllable`);
if ((r.accounts || []).length) say(`    ${C.ok}✓${C.off} accounts ${r.accounts.length}`);
if ((r.rfid || []).length) say(`    ${C.ok}✓${C.off} rfid     ${r.rfid.length} owned card(s)`);
say();

// ── AMBER posture ───────────────────────────────────────────────────────────
say(`${C.hi}  AMBER capabilities${C.off} ${C.dim}(jurisdiction-gated)${C.off}`);
const amber = [
  ['RF transmit', j.rf?.tx_allowed, `${(r.rf?.tx_bands || []).length} band(s) registered`],
  ['RFID/NFC emulation', j.rfid_emulation_allowed, `${(r.rfid || []).length} owned card(s)`],
  ['camera / mic', j.camera_mic?.recording_allowed, j.camera_mic?.require_confirmation ? 'consent confirm required' : 'no confirm required'],
];
for (const [name, on, note] of amber) {
  say(`    ${on ? C.warn + 'ON ' : C.ok + 'OFF'}${C.off} ${name.padEnd(22)} ${C.dim}${note}${C.off}`);
}
if (j.amber_enabled === false) say(`    ${C.ok}master switch amber_enabled=false — all of the above are disabled${C.off}`);
say(`    ${C.ok}RF receive${C.off} is always available ${C.dim}(listening is legal; not registry-bound)${C.off}`);
say();

// ── live probes: prove it, don't assert it ──────────────────────────────────
say(`${C.hi}  LIVE PROBES${C.off} ${C.dim}(actual gate decisions on your config)${C.off}`);
const own = nets[0]?.cidr;
const probes = [
  own && ['scan your own network', { verb: 'scan', class: 'network', target: own }],
  ['scan 8.8.8.8 (public)', { verb: 'scan', class: 'network', target: '8.8.8.8' }],
  ['scan 10.0.0.0/8 (not yours)', { verb: 'scan', class: 'network', target: '10.0.0.0/8' }],
  ['emulate a stranger card', { verb: 'emulate', class: 'flipper', target: 'nfc:DEADBEEF' }],
  ['transmit 915 MHz', { verb: 'transmit', class: 'sdr', target: 'rf:915000000' }],
].filter(Boolean);

for (const [label, cmd] of probes) {
  const v = authorize(cmd, cfg);
  const tag = v.allowed ? `${C.ok}ALLOW${C.off}` : `${C.red}DENY ${C.off}`;
  say(`    ${tag} ${label.padEnd(30)} ${C.dim}${v.reason || ''}${C.off}`);
}
say();
rule();
say(`  ${C.dim}Anything not listed above is denied and written to the audit log.${C.off}`);
say(`  ${C.dim}Gate-logic proof (fixed fixtures): ${C.off}${C.hi}npm run check${C.off}`);
say();

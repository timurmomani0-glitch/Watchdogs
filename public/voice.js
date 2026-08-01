'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// DedSec voice + operating presence.
//
// A spoken command is NOT a new power. Every utterance is parsed into the same
// { verb, class, target } the buttons send, handed to the same WebSocket command
// bus, authorized by the same scope gate, and written to the same audit log. The
// voice layer can therefore never touch anything you don't own — say "scan the
// neighbour's wifi" and the gate denies it exactly as a typed command would, and
// DedSec says so out loud.
//
// Mutating verbs (control / wake / transmit / emulate / purge) are held behind a
// spoken confirmation, mirroring the camera-consent gate: DedSec repeats the
// action back and waits for "confirm" before dispatch.
//
// Requires the Web Speech API (Chrome/Edge) and a secure context — localhost is
// fine; over the LAN by IP the browser needs HTTPS for the microphone.
// ─────────────────────────────────────────────────────────────────────────────

const DedSec = (() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  const supported = !!SR && !!synth;

  let vocab = { cidr: null, ha: [], wol: [], cameras: [], accounts: [], tx: null, rfid: null };
  let listening = false;
  let awake = false;              // wake-word heard; next phrase is a command
  let awakeTimer = null;
  let pending = null;             // a staged mutating command awaiting "confirm"
  let voiceMuted = localStorage.getItem('ctosVoiceMuted') === '1';
  let rec = null;

  const WAKE = /\b(ded ?sec|see ?tos|ctos|hey ded ?sec)\b/i;

  // ── output ────────────────────────────────────────────────────────────────
  let preferredVoice = null;
  function pickVoice() {
    const vs = synth.getVoices();
    // Prefer a low, machine-ish English voice; fall back to anything English.
    preferredVoice =
      vs.find((v) => /Google UK English Male|Daniel|Microsoft.*(David|George|Mark)/i.test(v.name)) ||
      vs.find((v) => /en[-_]/i.test(v.lang)) || vs[0] || null;
  }
  if (supported) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  function speak(text, { interrupt = false } = {}) {
    transcript(text, 'dedsec');
    if (!supported || voiceMuted) return;
    if (interrupt) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) u.voice = preferredVoice;
    u.rate = 1.02; u.pitch = 0.7; u.volume = 0.95;   // cold, flat, a little low
    synth.speak(u);
  }

  // ── transcript UI ───────────────────────────────────────────────────────────
  function transcript(text, who) {
    const box = document.querySelector('#voiceLog');
    if (!box) return;
    const line = document.createElement('div');
    line.className = 'vline ' + who;
    const tag = document.createElement('span');
    tag.className = 'vwho';
    tag.textContent = who === 'you' ? '▸ you' : who === 'dedsec' ? '◈ dedsec' : '·';
    line.appendChild(tag);
    // textContent, never innerHTML — recognised speech and alert fields are
    // untrusted strings and must never be parsed as markup.
    line.appendChild(document.createTextNode(' ' + text));
    box.prepend(line);
    while (box.children.length > 24) box.lastChild.remove();
  }

  function setIndicator() {
    const b = document.querySelector('#micToggle');
    if (b) {
      b.classList.toggle('live', listening);
      b.classList.toggle('awake', awake);
      b.textContent = listening ? (awake ? '● LISTENING' : '◉ MIC on') : '◌ MIC';
    }
    document.body.classList.toggle('dedsec-awake', awake);
  }

  // ── target resolution (labels → owned targets ONLY) ─────────────────────────
  function findByLabel(list, said) {
    const s = said.toLowerCase();
    // exact-ish contains match, then loosest word overlap
    return list.find((x) => s.includes(x.label.toLowerCase())) ||
      list.find((x) => x.label.toLowerCase().split(/\s+/).some((w) => w.length > 2 && s.includes(w))) || null;
  }
  const ACTION_ON = /\b(on|open|unlock|start|enable|turn on)\b/;
  const ACTION_OFF = /\b(off|close|lock|stop|disable|turn off)\b/;

  // ── grammar: utterance → intent ─────────────────────────────────────────────
  // Read-only intents dispatch immediately. Mutating intents return
  // { confirm, speak, cmd } and are staged until the operator says "confirm".
  function interpret(said) {
    const s = said.toLowerCase().trim();

    if (/\b(help|what can you do|commands)\b/.test(s)) {
      return { say: helpText() };
    }
    if (/\b(status|report|sitrep|situation)\b/.test(s)) { speakStatus(); return { handled: true }; }
    if (/\b(who('?s| is) (home|here)|presence|anyone home)\b/.test(s)) { speakPresence(); return { handled: true }; }
    if (/\b(verify|check).*(audit|chain)|audit (status|chain)\b/.test(s)) { speakAudit(); return { handled: true }; }

    // scan — explicit spoken CIDR/IP is honoured (and denied by the gate if out
    // of scope: that is the point). "my network" resolves to the owned CIDR.
    const cidr = s.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2})\b/);
    if (/\bscan\b/.test(s)) {
      if (cidr) return { dispatch: { verb: 'scan', class: 'network', target: cidr[1] } };
      if (vocab.cidr) return { dispatch: { verb: 'scan', class: 'network', target: vocab.cidr } };
      return { say: 'No network is registered. Run setup first.' };
    }
    const ip = s.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    if (/\b(profile|who is|look up|identify)\b/.test(s) && ip) {
      return { dispatch: { verb: 'read', class: 'network', target: ip[1] } };
    }
    if (/\b(sweep|scan now|check the network)\b/.test(s)) { doSweep(); return { handled: true }; }

    // home assistant control — mutating → confirm
    if (/\b(light|lamp|switch|plug|turn|toggle)\b/.test(s)) {
      const dev = findByLabel(vocab.ha, s);
      if (!dev) return { say: 'I have no registered device by that name.' };
      const action = ACTION_ON.test(s) ? 'turn_on' : ACTION_OFF.test(s) ? 'turn_off' : 'toggle';
      return confirmCmd(`${action.replace('_', ' ')} ${dev.label}`,
        { verb: 'control', class: 'homeassistant', target: dev.target, params: { action } });
    }

    // wake-on-lan — mutating → confirm
    if (/\b(wake|boot|power on|wake up)\b/.test(s)) {
      const dev = findByLabel(vocab.wol, s);
      if (!dev) return { say: 'No wake-on-LAN device by that name is registered.' };
      return confirmCmd(`wake ${dev.label}`, { verb: 'control', class: 'wol', target: dev.target });
    }

    // AMBER: transmit — only offered if the profile enabled TX
    if (/\b(transmit|key up|broadcast)\b/.test(s)) {
      if (!vocab.tx) return { say: 'Transmit is disabled in the jurisdiction profile.' };
      return confirmCmd(`transmit on ${(vocab.tx.hz / 1e6).toFixed(2)} megahertz`,
        { verb: 'transmit', class: 'sdr', target: vocab.tx.target });
    }
    // AMBER: emulate own card
    if (/\b(emulate|replay|clone).*(card|badge|fob)\b/.test(s)) {
      if (!vocab.rfid) return { say: 'Card emulation is disabled in the jurisdiction profile.' };
      return confirmCmd('emulate your own card', { verb: 'emulate', class: 'flipper', target: vocab.rfid.target });
    }

    // destructive local op
    if (/\b(purge|wipe|clear).*(history|sightings|log)\b/.test(s)) {
      return { confirm: 'purge the sighting history', run: doPurge };
    }

    // the boundary demo, spoken: naming a stranger's stuff
    if (/\b(neighbou?r|stranger|someone else|their)\b/.test(s)) {
      return { say: 'Out of scope. I only operate on what you own. Register it first, and I will.' };
    }

    return { say: null };   // unrecognised — stay quiet, keep listening
  }

  function confirmCmd(phrase, cmd) {
    return { confirm: phrase, cmd };
  }

  // ── dispatch (through the same bus the buttons use) ─────────────────────────
  function dispatch(cmd) {
    transcript(`${cmd.verb} ${cmd.class} → ${cmd.target}`, 'sys');
    if (typeof window.send === 'function') window.send(cmd);
    else speak('Command bus offline. I cannot reach the server.');
  }

  // ── main utterance handler ──────────────────────────────────────────────────
  function onUtterance(said) {
    transcript(said, 'you');

    // A pending confirmation short-circuits everything.
    if (pending) {
      if (/\b(confirm|do it|yes|affirmative|execute|go)\b/i.test(said)) {
        const p = pending; pending = null; setIndicator();
        speak('Confirmed.');
        if (p.run) p.run(); else dispatch(p.cmd);
      } else if (/\b(cancel|no|stop|abort|negative|never mind)\b/i.test(said)) {
        pending = null; setIndicator(); speak('Cancelled.');
      } else {
        speak('Say confirm, or cancel.');
      }
      return;
    }

    // Require the wake word, then stay awake briefly for a follow-up command.
    if (!awake) {
      if (WAKE.test(said)) {
        awake = true; setIndicator(); armAwake();
        // allow "dedsec, scan my network" in one breath
        const after = said.replace(WAKE, '').trim();
        if (after.length > 2) return route(after);
        speak('Listening.');
      }
      return;
    }
    armAwake();
    route(said);
  }

  function route(said) {
    const intent = interpret(said);
    if (intent.handled) return;
    if (intent.dispatch) return dispatch(intent.dispatch);
    if (intent.confirm) {
      pending = { cmd: intent.cmd, run: intent.run };
      setIndicator();
      speak(`Confirm: ${intent.confirm}. Say confirm, or cancel.`);
      return;
    }
    if (intent.say) speak(intent.say);
  }

  function armAwake() {
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(() => { awake = false; pending = null; setIndicator(); }, 12000);
  }

  // ── spoken status readouts (read live UI state / endpoints) ──────────────────
  async function speakStatus() {
    try {
      const s = await (await fetch('/api/system')).json();
      const w = await (await fetch('/api/watch')).json();
      const parts = [`ctOS online for ${s.owner}.`];
      parts.push(`Jurisdiction ${s.jurisdiction.country}. AMBER ${s.jurisdiction.amber_enabled ? 'enabled' : 'off'}.`);
      if (w.ran) parts.push(`Watching ${w.cidr}. ${w.seen} devices seen, ${w.unregistered} unregistered.`);
      else parts.push('No network sweep is running yet.');
      parts.push(s.audit.ok ? `Audit chain intact, ${s.audit.checked} entries.` : 'Audit chain broken.');
      speak(parts.join(' '));
    } catch { speak('I cannot reach the server.'); }
  }
  async function speakPresence() {
    try {
      const p = await (await fetch('/api/presence')).json();
      if (!p.totalRegistered) return speak('No devices registered, so I cannot judge presence.');
      speak(p.home ? `Home. ${p.onlineCount} of your ${p.totalRegistered} devices are online.`
                   : 'Away. None of your registered devices are online.');
    } catch { speak('I cannot reach the server.'); }
  }
  async function speakAudit() {
    try {
      const s = await (await fetch('/api/system')).json();
      speak(s.audit.ok ? `Audit chain verified. ${s.audit.checked} entries, no tampering.`
                       : `Audit chain broken at entry ${s.audit.brokenAt}.`);
    } catch { speak('I cannot reach the server.'); }
  }
  async function doSweep() {
    speak('Sweeping the network.');
    try {
      const r = await (await fetch('/api/watch/sweep', { method: 'POST' })).json();
      speak(r.ran ? `${r.seen} devices. ${r.unregistered} unregistered.` : (r.reason || 'Sweep unavailable.'));
      window.loadWatch?.(); window.loadHistory?.(); window.loadDevices?.();
    } catch { speak('Sweep failed. Server unreachable.'); }
  }
  async function doPurge() {
    try { await fetch('/api/history/purge', { method: 'POST' }); speak('Sighting history purged.'); window.loadHistory?.(); }
    catch { speak('Purge failed.'); }
  }

  function helpText() {
    const b = [];
    b.push('Say DedSec, then a command.');
    if (vocab.cidr) b.push(`Scan my network. Profile an address. Status. Who is home. Verify the audit.`);
    if (vocab.ha.length) b.push(`Turn ${vocab.ha[0].label} on or off.`);
    if (vocab.wol.length) b.push(`Wake ${vocab.wol[0].label}.`);
    b.push('Mutating commands ask for confirmation first.');
    return b.join(' ');
  }

  // ── events spoken by the presence (hooked from ctos.js) ──────────────────────
  function onAlert(a) {
    if (a.kind === 'unregistered') {
      speak(`Alert. Unregistered device on your network. ${a.vendor || 'unknown vendor'} at ${sayIp(a.ip)}.`, { interrupt: true });
    } else if (a.kind === 'join') {
      transcript(`joined: ${a.ip}`, 'sys');
    } else if (a.kind === 'leave') {
      transcript(`left: ${a.ip}`, 'sys');
    }
  }
  function onResult(r) {
    if (r.denied) speak(`Denied. ${r.reason || 'Out of scope.'}`);
    else if (r.amber) speak('Authorized. Amber capability.');
    // GREEN allows are frequent (every profile click) — stay quiet unless awake.
    else if (awake) speak('Done.');
  }
  const sayIp = (ip) => String(ip || '').replace(/\./g, ' dot ');

  // ── recognition lifecycle ────────────────────────────────────────────────────
  function start() {
    if (!supported) { speak(''); transcript('Voice needs Chrome or Edge over localhost/HTTPS.', 'sys'); return; }
    if (listening) return;
    rec = new SR();
    rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onUtterance(e.results[i][0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        listening = false; setIndicator();
        transcript('Microphone permission denied.', 'sys');
      }
    };
    rec.onend = () => { if (listening) { try { rec.start(); } catch {} } };   // keep-alive
    try { rec.start(); listening = true; awake = false; setIndicator();
      speak('DedSec online. Say DedSec to wake me.'); }
    catch { transcript('Could not start the microphone.', 'sys'); }
  }
  function stop() {
    listening = false; awake = false; pending = null;
    try { rec && rec.stop(); } catch {}
    setIndicator();
  }
  function toggle() { listening ? stop() : start(); }
  function setVoiceMuted(m) {
    voiceMuted = m; localStorage.setItem('ctosVoiceMuted', m ? '1' : '0');
    if (m) synth.cancel();
    const b = document.querySelector('#voiceMute');
    if (b) { b.classList.toggle('muted', m); b.textContent = m ? '🔇 VOICE' : '🔊 VOICE'; }
  }

  async function loadVocab() {
    try { vocab = await (await fetch('/api/voice/vocab')).json(); } catch {}
  }

  function init() {
    loadVocab();
    document.querySelector('#micToggle')?.addEventListener('click', toggle);
    document.querySelector('#voiceMute')?.addEventListener('click', () => setVoiceMuted(!voiceMuted));
    setVoiceMuted(voiceMuted);
    setIndicator();
    if (!supported) transcript('Voice unavailable — use Chrome or Edge on localhost/HTTPS.', 'sys');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { onAlert, onResult, speak, start, stop, toggle, supported };
})();
window.DedSec = DedSec;

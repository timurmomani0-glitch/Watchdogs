// Finance / Notification feed — YOUR OWN accounts via an official aggregator.
//
// LIVE: Plaid / Teller / TrueLayer / GoCardless (Nordigen) exchange your own
// credentials for a token, then expose read-only balances + transactions. Keys
// live in env (PLAID_CLIENT_ID/SECRET/ACCESS_TOKEN), never in the registry.
// Only account ids listed in registry.accounts are ever queried.
const MODE = process.env.INTEGRATION_MODE || 'mock';

export async function balances(accounts = []) {
  if (MODE === 'live') {
    // Placeholder: call aggregator /accounts/balance for each provider token.
  }
  return accounts.map((a, i) => ({
    id: a.id,
    label: a.label || a.id,
    provider: a.provider,
    balance: [4820.55, 12750.0, 318.42, 9600.0][i % 4],
    currency: 'USD',
    delta24h: [12.5, -40.0, 3.1, 0][i % 4],
  }));
}

export async function notifications() {
  // Own-domain events only: your bank alerts, your server alerts, your calendar.
  return [
    { t: 'now', kind: 'finance', msg: 'Direct deposit posted: +$2,400.00', level: 'ok' },
    { t: '-6m', kind: 'server', msg: 'vps-01 CPU 12% · disk 41% · uptime 38d', level: 'info' },
    { t: '-22m', kind: 'security', msg: 'New device joined home-lan (authorized)', level: 'warn' },
    { t: '-1h', kind: 'finance', msg: 'Card charge: $18.30 coffee', level: 'info' },
  ];
}

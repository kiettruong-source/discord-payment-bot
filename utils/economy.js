const fs = require('fs');
const path = require('path');

// Persistence lives on the Railway volume (/app/data) when present, otherwise
// the repo root — same convention as commands/createprofile.js. __dirname here
// is utils/, so the local fallback is one level up (repo root).
const dataDir = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '..');
const balancesPath = path.join(dataDir, 'balances.json');

const STARTING_BALANCE = 1000;
const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_BET = 10;
// Bot owners (Valy, Vani) — may grant coins alongside server admins.
const OWNER_IDS = ['1274644670193995870', '422009646031568908'];

function readBalances() {
  if (!fs.existsSync(balancesPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(balancesPath, 'utf-8'));
  } catch (e) {
    console.error('Failed to parse balances.json', e);
    return {};
  }
}

function writeBalances(balances) {
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2), 'utf-8');
}

function ensureUser(balances, userId) {
  if (!balances[userId] || typeof balances[userId] !== 'object') {
    balances[userId] = { coins: STARTING_BALANCE, lastDaily: 0 };
  }
  if (typeof balances[userId].coins !== 'number') balances[userId].coins = STARTING_BALANCE;
  if (typeof balances[userId].lastDaily !== 'number') balances[userId].lastDaily = 0;
  return balances[userId];
}

// Returns the user's coin balance, minting the starting balance on first touch.
function getBalance(userId) {
  const balances = readBalances();
  const created = !balances[userId];
  ensureUser(balances, userId);
  if (created) writeBalances(balances);
  return balances[userId].coins;
}

// The single money-mutation primitive: atomic read-modify-write (no await inside),
// so concurrent invocations serialize on Node's event loop. Coins clamp at 0.
function addCoins(userId, delta) {
  const balances = readBalances();
  const rec = ensureUser(balances, userId);
  rec.coins = Math.max(0, rec.coins + delta);
  writeBalances(balances);
  return rec.coins;
}

// Grants the daily reward if the cooldown has elapsed.
function claimDaily(userId, now) {
  const balances = readBalances();
  const rec = ensureUser(balances, userId);
  const elapsed = now - rec.lastDaily;
  if (elapsed < DAILY_COOLDOWN_MS) {
    return { ok: false, remainingMs: DAILY_COOLDOWN_MS - elapsed };
  }
  rec.coins += DAILY_AMOUNT;
  rec.lastDaily = now;
  writeBalances(balances);
  return { ok: true, amount: DAILY_AMOUNT, newBalance: rec.coins };
}

module.exports = {
  STARTING_BALANCE,
  DAILY_AMOUNT,
  DAILY_COOLDOWN_MS,
  MIN_BET,
  OWNER_IDS,
  getBalance,
  addCoins,
  claimDaily,
};

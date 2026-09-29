// Draft Room engine: snake draft, AI managers with personalities, pick advice, grading.
// Pure functions + one Draft class. No dependencies.

export const ROUNDS = 15;
export const STARTERS = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DEF: 1 };
const CAPS = { QB: 3, RB: 7, WR: 7, TE: 3, K: 1, DEF: 1 };
const LATE_ROUND = 12;              // most managers wait until here for K and DEF

const rand = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pick1 = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Each personality nudges a player's effective ADP (lower = more wanted) and explains itself.
export const PERSONALITIES = [
  { name: 'Spreadsheet Steve', style: 'Follows ADP to the decimal', noise: 0.02, kdefEarly: true,
    adj: () => 1, why: () => 'ADP said so.' },
  { name: 'Zero-RB Zoe', style: 'Refuses running backs early', noise: 0.12,
    adj: (p, rd) => (p.pos === 'RB' && rd <= 6 ? 3.5 : 1), why: (p) => (p.pos === 'RB' ? 'Fine. ONE running back.' : 'Running backs are a myth.') },
  { name: 'Homer Hank', style: 'Loves one team a little too much', noise: 0.12, team: true,
    adj: (p, rd, me) => (p.t === me.team ? 0.55 : 1), why: (p, me) => (p.t === me.team ? `Go ${me.team}! Loyalty over logic.` : 'Begrudgingly, a non-' + me.team + ' player.') },
  { name: 'Chaos Carl', style: 'Drafts on vibes', noise: 0.4,
    adj: () => 1, why: (p, me, pickNo) => (pickNo < p.adp - 12 ? `Reached ${Math.round(p.adp - pickNo)} spots. No regrets.` : 'The vibes were right.') },
  { name: 'QB Quinn', style: 'Needs an elite quarterback', noise: 0.12,
    adj: (p, rd) => (p.pos === 'QB' && rd <= 5 ? 0.35 : 1), why: (p, me) => (p.pos === 'QB' ? 'Quarterbacks win championships.' : me.roster.some((x) => x.pos === 'QB') ? 'Surrounding my QB with weapons.' : 'Weapons first. My QB is coming.') },
  { name: 'Rookie Rae', style: 'Buys every rookie', noise: 0.15,
    adj: (p) => (p.rk ? 0.55 : 1), why: (p) => (p.rk ? 'Rookie. Upside. Destiny.' : 'Needed a grown-up on the roster.') },
  { name: 'Wideout Wes', style: 'Stacks wide receivers', noise: 0.12,
    adj: (p) => (p.pos === 'WR' ? 0.75 : 1), why: (p, me) => (p.pos === 'WR' ? 'You can never have too many WRs.' : me.roster.some((x) => x.pos === 'WR') ? 'Taking a break from WRs. Briefly.' : 'Relax. The WRs are coming.') },
  { name: 'Bellcow Bo', style: 'Hoards running backs', noise: 0.12,
    adj: (p, rd) => (p.pos === 'RB' && rd <= 5 ? 0.7 : 1), why: (p, me) => (p.pos === 'RB' ? 'Workhorse secured.' : me.roster.some((x) => x.pos === 'RB') ? 'Filling in around my backfield.' : 'The backfield can wait. One round.') },
  { name: 'Tight End Tina', style: 'Believes in the tight end edge', noise: 0.12,
    adj: (p, rd) => (p.pos === 'TE' && rd <= 6 ? 0.45 : 1), why: (p) => (p.pos === 'TE' ? 'The positional advantage is real.' : 'Solid value.') },
  { name: 'Veteran Vic', style: 'Trusts proven players', noise: 0.1,
    adj: (p) => (p.rk ? 1.6 : 1), why: () => 'Proven production. Boring is good.' },
  { name: 'Autodraft Andy', style: 'Missed the draft; the app picks for him', noise: 0.04, autodraft: true,
    adj: () => 1, why: () => '(Andy is still at lunch. Autopick.)' }
];

// Value over replacement: points above the last starter-quality player at each position.
export function replacementLevels(players, teams) {
  const depth = { QB: teams, RB: Math.round(teams * 2.5), WR: Math.round(teams * 2.5), TE: teams, K: teams, DEF: teams };
  const out = {};
  for (const pos in depth) {
    const pts = players.filter((p) => p.pos === pos).map((p) => p.pts).sort((a, b) => b - a);
    out[pos] = pts[Math.min(depth[pos], pts.length - 1)] ?? 0;
  }
  return out;
}

// Best projected starting lineup (QB, 2 RB, 2 WR, TE, FLEX, K, DEF) plus a little credit for depth.
export function lineup(roster) {
  const by = {};
  for (const p of roster) (by[p.pos] ||= []).push(p);
  for (const k in by) by[k].sort((a, b) => b.pts - a.pts);
  const take = (pos, n) => (by[pos] || []).splice(0, n);
  const starters = [...take('QB', 1), ...take('RB', 2), ...take('WR', 2), ...take('TE', 1)];
  const flex = [...(by.RB || []), ...(by.WR || []), ...(by.TE || [])].sort((a, b) => b.pts - a.pts)[0];
  if (flex) { starters.push(flex); by[flex.pos].splice(by[flex.pos].indexOf(flex), 1); }
  starters.push(...take('K', 1), ...take('DEF', 1));
  const bench = roster.filter((p) => !starters.includes(p));
  const starterPts = starters.reduce((a, p) => a + p.pts, 0);
  const benchPts = bench.reduce((a, p) => a + p.pts, 0);
  return { starters, bench, starterPts, score: starterPts + 0.12 * benchPts };
}

const count = (roster, pos) => roster.filter((p) => p.pos === pos).length;
function openStarterSlots(roster, pos) {
  if (pos === 'K' || pos === 'DEF' || pos === 'QB' || pos === 'TE') return Math.max(0, STARTERS[pos] - count(roster, pos));
  const flexUsed = Math.max(0, count(roster, 'RB') - 2) + Math.max(0, count(roster, 'WR') - 2) + Math.max(0, count(roster, 'TE') - 1);
  return Math.max(0, STARTERS[pos] - count(roster, pos)) + (flexUsed ? 0 : 1);
}

export class Draft {
  constructor(data, { teams = 12, slot = 1, teamName = 'You' } = {}) {
    this.players = data.players;
    this.teams = teams;
    this.repl = replacementLevels(this.players, teams);
    const bots = [...PERSONALITIES].sort(() => Math.random() - 0.5).slice(0, teams - 1);
    const nflTeams = [...new Set(this.players.map((p) => p.t))].filter((t) => t !== 'FA');
    this.managers = [];
    for (let i = 0, b = 0; i < teams; i++) {
      if (i === slot - 1) this.managers.push({ name: teamName, human: true, roster: [] });
      else {
        const pers = bots[b++];
        this.managers.push({ ...pers, team: pers.team ? pick1(nflTeams) : null, roster: [] });
      }
    }
    this.pickNo = 1;                 // overall pick, 1-based
    this.taken = new Set();
    this.log = [];                   // { pickNo, round, manager, player, why }
  }

  get total() { return this.teams * ROUNDS; }
  get done() { return this.pickNo > this.total; }
  get round() { return Math.ceil(this.pickNo / this.teams); }
  managerIndexFor(pickNo) {
    const r = Math.ceil(pickNo / this.teams), i = (pickNo - 1) % this.teams;
    return r % 2 === 1 ? i : this.teams - 1 - i;
  }
  get onClock() { return this.managers[this.managerIndexFor(this.pickNo)]; }
  get available() { return this.players.filter((p) => !this.taken.has(p.id)); }

  nextPickFor(managerIdx, after = this.pickNo) {
    for (let n = after + 1; n <= this.total; n++) if (this.managerIndexFor(n) === managerIdx) return n;
    return null;
  }

  canTake(m, p) {
    if (count(m.roster, p.pos) >= CAPS[p.pos]) return false;
    // Always leave room to fill every starting slot by the end
    const left = ROUNDS - m.roster.length;
    const mustFill = ['QB', 'TE', 'K', 'DEF'].reduce((a, pos) => a + Math.max(0, STARTERS[pos] - count(m.roster, pos)), 0)
      + Math.max(0, 2 - count(m.roster, 'RB')) + Math.max(0, 2 - count(m.roster, 'WR'));
    const fillsNeed = openStarterSlots(m.roster, p.pos) > 0;
    return fillsNeed || left > mustFill;
  }

  makePick(player, why = '') {
    const m = this.onClock;
    m.roster.push(player);
    this.taken.add(player.id);
    this.log.push({ pickNo: this.pickNo, round: this.round, manager: m, player, why });
    this.pickNo++;
    return this.log[this.log.length - 1];
  }

  botPick() {
    const m = this.onClock, rd = this.round;
    let best = null, bestScore = Infinity;
    for (const p of this.available) {
      if (!this.canTake(m, p)) continue;
      if ((p.pos === 'K' || p.pos === 'DEF') && rd < LATE_ROUND && !m.kdefEarly) continue;
      let eff = m.autodraft ? 400 - p.pts : p.adp;
      eff *= m.adj(p, rd, m);
      eff *= Math.exp(m.noise * gauss());
      if (openStarterSlots(m.roster, p.pos) === 0) eff *= rd <= 8 ? 1.35 : 1.8;  // already covered here
      if (rd >= ROUNDS - 2 && openStarterSlots(m.roster, p.pos) > 0) eff *= 0.2;  // must fill starters
      if (eff < bestScore) { bestScore = eff; best = p; }
    }
    return this.makePick(best, m.why(best, m, this.pickNo));
  }

  // Top suggestions for the human, with plain-English reasons.
  suggest(n = 3) {
    const me = this.managers.findIndex((m) => m.human);
    const m = this.managers[me], rd = this.round;
    const next = this.nextPickFor(me);
    return this.available
      .filter((p) => this.canTake(m, p))
      .map((p) => {
        const vor = p.pts - this.repl[p.pos];
        let s = Math.max(vor, 0) + 0.02 * p.pts;
        const reasons = [];
        const open = openStarterSlots(m.roster, p.pos);
        if (open > 0) { s *= 1.15; reasons.push(`fills a ${p.pos} starting spot`); }
        else { s *= 0.6; reasons.push(`${p.pos} is already covered`); }
        if ((p.pos === 'K' || p.pos === 'DEF') && rd < LATE_ROUND) { s *= 0.15; }
        const goneSoon = next === null || p.adp < next - 1;
        if (goneSoon) { s *= 1.1; reasons.push(next ? `probably gone before your next pick (#${next})` : 'last chance'); }
        else { s *= 0.85; reasons.push(`likely still there at pick #${next}`); }
        if (this.pickNo - p.adp > 8) reasons.push(`a value: usually gone by pick ${Math.round(p.adp)}`);
        return { p, s, vor, reasons };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, n);
  }

  results() {
    const table = this.managers.map((m) => ({ m, ...lineup(m.roster) })).sort((a, b) => b.starterPts - a.starterPts || b.score - a.score);
    const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'D-', 'F'];
    table.forEach((row, i) => { row.rank = i + 1; row.grade = grades[Math.min(grades.length - 1, Math.floor((i / this.teams) * 12))]; });
    // delta > 0: taken later than ADP (a value). delta < 0: taken earlier than ADP (a reach).
    const mine = this.log.filter((l) => l.manager.human).map((l) => ({ ...l, delta: l.pickNo - l.player.adp }));
    const steal = mine.reduce((a, b) => (b.delta > a.delta ? b : a), mine[0]);
    const reach = mine.reduce((a, b) => (b.delta < a.delta ? b : a), mine[0]);
    if (reach && reach.delta > -1) return { table, steal, reach: null };
    return { table, steal, reach };
  }
}

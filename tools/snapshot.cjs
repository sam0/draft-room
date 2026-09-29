// Snapshots Sleeper's public 2026 PPR projections + ADP into docs/data.json for the web app.
// Usage: node tools/snapshot.cjs
const SEASON = process.env.SEASON || '2026';
const url = `https://api.sleeper.app/projections/nfl/${SEASON}?season_type=regular` +
  ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `&position%5B%5D=${p}`).join('') + '&order_by=adp_ppr';

(async () => {
  const rows = await (await fetch(url)).json();
  const players = rows
    .filter((r) => r.stats && r.stats.adp_ppr > 0 && r.stats.adp_ppr < 400 && r.stats.pts_ppr > 0)
    .filter((r) => ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(r.player.position))
    .sort((a, b) => a.stats.adp_ppr - b.stats.adp_ppr)
    .slice(0, 320)
    .map((r) => ({
      id: r.player_id,
      n: r.player.position === 'DEF' ? `${r.player.last_name || r.team} D/ST` : `${r.player.first_name} ${r.player.last_name}`,
      pos: r.player.position,
      t: r.team || r.player.team || 'FA',
      adp: r.stats.adp_ppr,
      pts: Math.round(r.stats.pts_ppr * 10) / 10,
      rk: r.player.years_exp === 0 ? 1 : 0
    }));
  const fs = require('fs');
  fs.writeFileSync('docs/data.json', JSON.stringify({ season: SEASON, snapshot: new Date().toISOString().slice(0, 10), players }));
  const byPos = players.reduce((a, p) => ((a[p.pos] = (a[p.pos] || 0) + 1), a), {});
  console.log(`${players.length} players`, byPos, `${(fs.statSync('docs/data.json').size / 1024).toFixed(0)} KB`);
})();

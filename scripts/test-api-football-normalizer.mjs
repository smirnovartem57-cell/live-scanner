import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const moduleUrl = pathToFileURL(join(root, "dist-test", "services", "apiFootball", "normalizeApiFootball.js")).href;
const normalizer = await import(moduleUrl);

const fixture = {
  fixture: {
    id: 12345,
    status: { elapsed: 64, short: "2H" }
  },
  league: {
    name: "Spain LaLiga",
    country: "Spain"
  },
  teams: {
    home: { id: 10, name: "Barcelona", logo: "bar.png" },
    away: { id: 20, name: "Valencia", logo: "val.png" }
  },
  goals: {
    home: 0,
    away: 0
  }
};

const stats = [
  {
    team: { id: 10, name: "Barcelona" },
    statistics: [
      { type: "Shots on Goal", value: 6 },
      { type: "Total Shots", value: 15 },
      { type: "Corner Kicks", value: 9 },
      { type: "Ball Possession", value: "58%" },
      { type: "expected_goals", value: "1.62" },
      { type: "Dangerous Attacks", value: 56 },
      { type: "Attacks", value: 78 }
    ]
  },
  {
    team: { id: 20, name: "Valencia" },
    statistics: [
      { type: "Shots on Goal", value: 1 },
      { type: "Total Shots", value: 4 },
      { type: "Corner Kicks", value: 2 },
      { type: "Ball Possession", value: "42%" }
    ]
  }
];

const goalEvent = {
  time: { elapsed: 69 },
  team: { id: 10, name: "Barcelona" },
  type: "Goal",
  detail: "Normal Goal"
};

const match = normalizer.normalizeApiFootballMatch(fixture);
assert.equal(match.id, "12345");
assert.equal(match.league, "Spain LaLiga");
assert.equal(match.homeTeam, "Barcelona");
assert.equal(match.awayTeam, "Valencia");
assert.equal(match.minute, 64);
assert.equal(match.status, "live");

const snapshot = normalizer.normalizeApiFootballSnapshot(fixture, stats);
assert.equal(snapshot.matchId, "12345");
assert.equal(snapshot.home.shotsOnTarget, 6);
assert.equal(snapshot.home.shotsTotal, 15);
assert.equal(snapshot.home.corners, 9);
assert.equal(snapshot.home.possession, 58);
assert.equal(snapshot.home.xg, 1.62);
assert.equal(snapshot.home.dangerousAttacks, 56);
assert.equal(snapshot.away.shotsOnTarget, 1);

const event = normalizer.normalizeApiFootballEvent(goalEvent, fixture);
assert.equal(event.type, "goal");
assert.equal(event.minute, 69);
assert.equal(event.teamSide, "home");
assert.equal(event.teamId, "10");

const profiles = normalizer.normalizeApiFootballTeamProfiles(fixture);
assert.equal(profiles.length, 2);
assert.equal(profiles[0].name, "Barcelona");

console.log("API-FOOTBALL normalizer tests passed.");

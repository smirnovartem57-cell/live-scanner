import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const moduleUrl = pathToFileURL(join(root, "dist-test", "services", "apiFootball", "normalizeApiFootball.js")).href;
const normalizer = await import(moduleUrl);
const quotaPolicyUrl = pathToFileURL(join(root, "dist-test", "services", "apiFootball", "quotaPolicy.js")).href;
const quotaPolicy = await import(quotaPolicyUrl);
const defaultPatternsUrl = pathToFileURL(join(root, "dist-test", "services", "patternEngine", "defaultPatterns.js")).href;
const evaluatePatternUrl = pathToFileURL(join(root, "dist-test", "services", "patternEngine", "evaluatePattern.js")).href;
const { defaultPatterns } = await import(defaultPatternsUrl);
const { evaluatePattern } = await import(evaluatePatternUrl);

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

const realPattern = defaultPatterns.find((pattern) => pattern.id === "pressure_without_goal");
assert.ok(realPattern);
const realSignal = evaluatePattern(match, {
  ...snapshot,
  home: {
    shotsTotal: 15,
    shotsOnTarget: 6,
    corners: 9,
    possession: 58,
    xg: 1.62
  }
}, realPattern, "home");
assert.ok(realSignal, "supported API-FOOTBALL metrics should create a real signal");
assert.equal(realSignal.patternId, "pressure_without_goal");

const missingStats = normalizer.normalizeApiFootballTeamStats();
assert.equal(missingStats.shotsTotal, undefined);
assert.equal(missingStats.possession, undefined);

assert.equal(quotaPolicy.providerRequestsForFixtureCount(0), 1);
assert.equal(quotaPolicy.providerRequestsForFixtureCount(1), 3);
assert.equal(quotaPolicy.providerRequestsForFixtureCount(4), 9);
assert.equal(quotaPolicy.allowedDetailFixtureCount(null, 4, 5), 4);
assert.equal(quotaPolicy.allowedDetailFixtureCount(7, 4, 5), 1);
assert.equal(quotaPolicy.allowedDetailFixtureCount(6, 4, 5), 0);
assert.equal(quotaPolicy.allowedDetailFixtureCount(100, 99, 5), 4);

console.log("API-FOOTBALL normalizer tests passed.");

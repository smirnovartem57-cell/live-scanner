import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const load = (path) => import(pathToFileURL(join(root, "dist-test", path)).href);
const { buildPatternEvent, buildPatternStatsDaily } = await load("services/journalStorage/buildJournalEvents.js");
const { toPatternEvent } = await load("services/journalStorage/JournalReadClient.js");

const signal = {
  id: "match-1-late-home-6", matchId: "match-1", patternId: "late", patternType: "late_goal",
  teamId: "home-1", teamSide: "home", minute: 60, scoreHome: 0, scoreAway: 0,
  pressureScore: 78, strength: "HIGH", status: "in_progress", signalKind: "signal",
  statsAtSignal: { shotsTotal: 10 }, explanation: "Pressure", createdAt: "2026-07-23T10:00:00.000Z",
  updatedAt: "2026-07-23T10:00:00.000Z"
};
const match = { id: "match-1", league: "Test", homeTeam: "Home", awayTeam: "Away",
  minute: 70, scoreHome: 1, scoreAway: 0, status: "live", updatedAt: "2026-07-23T10:10:00.000Z" };
const goal = { id: "goal-1", matchId: "match-1", type: "goal", minute: 64, teamSide: "home" };
const event = buildPatternEvent(signal, match, [goal]);
assert.equal(event.status, "success");
assert.equal(event.result.goalWithin5, true);
assert.equal(event.result.goalWithin10, true);
assert.equal(event.result.goalWithin15, true);
assert.equal(event.result.goalMinute, 64);
assert.equal(event.closedAt !== null, true);

const failed = buildPatternEvent(signal, { ...match, minute: 76, scoreHome: 0 }, []);
assert.equal(failed.status, "failed");
assert.equal(failed.result.goalWithin15, false);

const warning = buildPatternEvent({ ...signal, id: "warning", patternType: "empty_pressure", signalKind: "warning" }, match, [goal]);
assert.equal(warning.status, "failed");

const row = {
  id: event.id, match_id: event.matchId, match_name: event.match, league: event.league,
  pattern_id: event.patternId, pattern_type: event.patternType, team_id: event.teamId,
  team_side: event.teamSide, minute: event.minute, score_home: event.scoreHome, score_away: event.scoreAway,
  score: event.score, pressure_score: event.pressureScore, strength: event.strength, status: event.status,
  signal_kind: event.signalKind, stats_at_signal: event.statsAtSignal, explanation: event.explanation,
  comment: event.comment, created_at: event.createdAt, updated_at: event.updatedAt,
  journal_signal_results: { goal_within_5: true, goal_within_10: true, goal_within_15: true,
    goal_minute: 64, goal_team: "home", final_comment: "ok", result_source: "auto", closed_at: event.closedAt }
};
assert.equal(toPatternEvent(row).result.goalMinute, 64);
assert.equal(toPatternEvent({ ...row, journal_signal_results: [row.journal_signal_results] }).result.goalMinute, 64);

const stats = buildPatternStatsDaily([event, failed]);
assert.equal(stats.length, 1);
assert.equal(stats[0].totalSignals, 2);
assert.equal(stats[0].successWithin15, 1);
assert.equal(stats[0].failedSignals, 1);

console.log("Journal and result tests passed.");

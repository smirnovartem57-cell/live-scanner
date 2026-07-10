import type { JournalSignalDedupeInput } from "./JournalStorage";

export function createJournalDedupeKey(input: JournalSignalDedupeInput, windowMinutes = 10) {
  const createdAt = new Date(input.createdAt);
  const bucketMs = windowMinutes * 60 * 1000;
  const bucketStart = Math.floor(createdAt.getTime() / bucketMs) * bucketMs;

  return [
    input.matchId,
    input.patternId,
    input.teamSide,
    new Date(bucketStart).toISOString()
  ].join(":");
}

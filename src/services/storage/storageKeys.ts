export const storageKeys = {
  serviceMeta: "football-pattern-lab-service-meta",
  patternEvents: "football-pattern-lab-pattern-events",
  patternSettings: "football-pattern-lab-pattern-settings",
  patternProfiles: "football-pattern-lab-pattern-profiles",
  teamNotes: "football-pattern-lab-team-notes",
  settings: "football-pattern-lab-settings"
} as const;

export type StorageKey = keyof typeof storageKeys;

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function withUpdatedAt(matches) {
  const now = new Date().toISOString();
  return matches.map((match) => ({ ...match, updatedAt: now }));
}

function createMockFootballProvider() {
  const data = window.FootballMockData;

  return {
    mode: "mock",
    getLiveMatches() {
      return withUpdatedAt(cloneData(data.matches));
    },
    getMatchStats() {
      return cloneData(data.snapshots);
    },
    getPatterns() {
      return cloneData(data.patterns);
    },
    getSeedSignals() {
      return cloneData(data.signals || []);
    },
    getSeedHistory() {
      return cloneData(data.history);
    },
    getTeamProfile(teamId) {
      return cloneData((data.teamProfiles || []).find((team) => team.id === teamId) || null);
    },
    getTeamRecentMatches(teamId) {
      const profile = (data.teamProfiles || []).find((team) => team.id === teamId);
      return cloneData(profile?.recentMatches || []);
    }
  };
}

window.FootballDataProvider = {
  createMockFootballProvider
};

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function withUpdatedAt(matches) {
  const now = new Date().toISOString();
  return matches.map((match) => ({ ...match, updatedAt: now }));
}

const footballDataProviderContract = [
  "getLiveMatches",
  "getMatchStats",
  "getMatchEvents",
  "getPatterns",
  "getSeedSignals",
  "getSeedHistory",
  "getTeamProfile",
  "getTeamRecentMatches",
  "getUserProfile",
  "getFeedbackItems"
];

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
    getMatchEvents(matchId) {
      return cloneData(data.events?.[matchId] || []);
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
    },
    getUserProfile() {
      return cloneData(data.userProfile || null);
    },
    getFeedbackItems() {
      return cloneData(data.feedbackItems || []);
    }
  };
}

function createRealFootballProvider() {
  return {
    mode: "real",
    getLiveMatches() {
      return [];
    },
    getMatchStats() {
      return [];
    },
    getMatchEvents() {
      return [];
    },
    getPatterns() {
      return [];
    },
    getSeedSignals() {
      return [];
    },
    getSeedHistory() {
      return [];
    },
    getTeamProfile() {
      return null;
    },
    getTeamRecentMatches() {
      return [];
    },
    getUserProfile() {
      return null;
    },
    getFeedbackItems() {
      return [];
    }
  };
}

function createFootballProvider(mode = "mock") {
  if (mode === "real") {
    return createRealFootballProvider();
  }

  return createMockFootballProvider();
}

window.FootballDataProvider = {
  contract: footballDataProviderContract,
  createFootballProvider,
  createMockFootballProvider,
  createRealFootballProvider
};

(function () {
  function getProfileViewModel(profile, journalStats) {
    if (!profile) return null;
    const trust = profile.socialTrust || {};

    return {
      ...profile,
      trust,
      summary: {
        totalEvents: journalStats.total,
        win: journalStats.win,
        lose: journalStats.lose,
        trustScore: trust.score || 0
      },
      trustMeterWidth: `${Math.min(100, trust.score || 0)}%`,
      trustNotes: trust.notes || [],
      permissions: profile.permissions || [],
      futureFields: profile.futureFields || []
    };
  }

  function getIdeasSummary(items) {
    return {
      ideaCount: items.filter((item) => item.type === "idea").length,
      feedbackCount: items.filter((item) => item.type === "feedback").length,
      highPriority: items.filter((item) => item.priority === "high").length,
      totalVotes: items.reduce((sum, item) => sum + item.votes, 0)
    };
  }

  window.LiveScannerSocialFeedback = {
    getIdeasSummary,
    getProfileViewModel
  };
})();

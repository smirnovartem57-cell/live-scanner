(function () {
  function buildTeamProfile({ selection, matches, snapshots, signals, history, provider, patternEngine, getJournalStats }) {
    const match = matches.find((item) => item.id === selection.matchId);
    const snapshot = match ? snapshots.find((item) => item.matchId === match.id) : null;
    if (!match || !snapshot) return null;

    const side = selection.side === "away" ? "away" : "home";
    const opponentSide = side === "home" ? "away" : "home";
    const teamName = side === "home" ? match.homeTeam : match.awayTeam;
    const opponentName = side === "home" ? match.awayTeam : match.homeTeam;
    const teamId = selection.teamId || (side === "home" ? match.homeTeamId : match.awayTeamId);
    const providerProfile = provider.getTeamProfile?.(teamId);
    const stats = snapshot[side];
    const opponent = snapshot[opponentSide];
    const pressureScore = patternEngine.calculatePressureScore(stats);
    const teamSignals = signals.filter((signal) => signal.matchId === match.id && signal.teamSide === side);
    const teamEvents = history.filter((event) => event.match?.includes(teamName));
    const journal = getJournalStats(teamEvents);
    const pressureGap = pressureScore - patternEngine.calculatePressureScore(opponent);
    const trend = snapshot.recent?.[side]?.dangerousAttacks >= snapshot.previous?.[side]?.dangerousAttacks
      ? "темп растет"
      : "темп стабильный или ниже";

    return {
      ...(providerProfile || {}),
      id: teamId,
      name: teamName,
      match,
      stats,
      signals: teamSignals,
      history: journal,
      pressureScore,
      summary: `${teamName} против ${opponentName}: ${stats.dangerousAttacks} опасных атак, ${stats.shotsTotal} ударов, ${stats.shotsOnTarget} в створ, ${stats.corners} угловых. Разница pressure score с соперником: ${pressureGap > 0 ? "+" : ""}${pressureGap}, ${trend}.`
    };
  }

  function getTeamNote(teamNotes, teamId) {
    return teamNotes[teamId] || { note: "", tags: [], updatedAt: null };
  }

  function updateTeamNote(teamNotes, teamId, patch, now = new Date()) {
    return {
      ...teamNotes,
      [teamId]: {
        ...getTeamNote(teamNotes, teamId),
        ...patch,
        updatedAt: now.toISOString()
      }
    };
  }

  function saveTeamNoteSnapshot(teamNotes, teamId, now = new Date()) {
    const current = getTeamNote(teamNotes, teamId);
    const entry = {
      id: `${teamId}-${now.getTime()}`,
      note: current.note || "",
      tags: current.tags || [],
      importantMatch: Boolean(current.importantMatch),
      createdAt: now.toISOString()
    };

    return updateTeamNote(teamNotes, teamId, {
      entries: [entry, ...(current.entries || [])].slice(0, 20)
    }, now);
  }

  function getTeamsWithNotes(teamNotes, matches, provider) {
    return Object.entries(teamNotes)
      .filter(([, note]) => note.note || note.importantMatch || (note.tags || []).length || (note.entries || []).length)
      .map(([teamId, note]) => ({
        teamId,
        name: getTeamNameById(teamId, matches, provider),
        noteCount: (note.entries || []).length,
        tags: note.tags || [],
        importantMatch: Boolean(note.importantMatch),
        updatedAt: note.updatedAt
      }))
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }

  function getTeamNameById(teamId, matches, provider) {
    const match = matches.find((item) => item.homeTeamId === teamId || item.awayTeamId === teamId);
    if (match?.homeTeamId === teamId) return match.homeTeam;
    if (match?.awayTeamId === teamId) return match.awayTeam;
    const providerProfile = provider.getTeamProfile?.(teamId);
    return providerProfile?.name || teamId;
  }

  window.LiveScannerTeamProfile = {
    buildTeamProfile,
    getTeamNameById,
    getTeamNote,
    getTeamsWithNotes,
    saveTeamNoteSnapshot,
    updateTeamNote
  };
})();

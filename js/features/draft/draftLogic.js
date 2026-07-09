export function getDraftTurn(session, ruleset) {
  const order = session?.pick_order || [];
  if (!order.length) return { memberId: null, round: 0, pick: 0 };
  const index = Math.max(0, Number(session.current_pick_index) || 0);
  const roundIndex = Math.floor(index / order.length);
  const position = index % order.length;
  const reversed = (ruleset?.draft_mode || 'snake') === 'snake' && roundIndex % 2 === 1;
  return {
    memberId: reversed ? order[order.length - 1 - position] : order[position],
    round: roundIndex + 1,
    pick: index + 1,
  };
}

export function rosterCost(picks, memberId, poolPokemon) {
  const costs = new Map(poolPokemon.map(mon => [mon.pokemon_id, Number(mon.cost) || 0]));
  return picks.filter(pick => pick.member_id === memberId)
    .reduce((sum, pick) => sum + (costs.get(pick.pokemon_id) || 0), 0);
}

export function normalizeRealtimeStatus(status) {
  return {
    SUBSCRIBED: 'connected',
    TIMED_OUT: 'error',
    CHANNEL_ERROR: 'error',
    CLOSED: 'offline',
  }[status] || 'connecting';
}

export function realtimeStatusCopy(status) {
  return {
    connected: { label: 'Live verbunden', hint: 'Änderungen werden automatisch synchronisiert.' },
    connecting: { label: 'Verbindung wird aufgebaut', hint: 'Der aktuelle Stand bleibt weiterhin sichtbar.' },
    offline: { label: 'Live-Verbindung getrennt', hint: 'Seite neu laden, um den aktuellen Stand abzurufen.' },
    error: { label: 'Live-Verbindung gestört', hint: 'Picks werden serverseitig geprüft. Bitte vor einem weiteren Versuch neu laden.' },
  }[status] || { label: 'Live-Status unbekannt', hint: 'Bitte Seite neu laden.' };
}

export function formatDraftError(error) {
  const message = String(error?.message || error || 'Unbekannter Fehler.');
  if (error?.code === '23505' || /duplicate key|idx_draft_picks_session_number/i.test(message)) {
    return 'Dieser Pick wurde bereits verarbeitet. Der Draft-Stand wird neu geladen.';
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return 'Keine Verbindung zum Server. Prüfe deine Internetverbindung und lade den Draft neu.';
  }
  return message;
}

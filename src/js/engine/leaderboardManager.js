/**
 * Local Leaderboard / Persistent Podium Manager.
 * Stores cumulative scores, songs played, and personal high scores across karaoke sessions.
 */

export class LeaderboardManager {
  static STORAGE_KEY = 'karaoke_leaderboard';

  static getLeaderboard() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      // Sort by cumulative total score descending
      return list.sort((a, b) => b.totalScore - a.totalScore);
    } catch (e) {
      console.warn('[Leaderboard] Error reading storage:', e);
      return [];
    }
  }

  static recordSongResults(results) {
    if (!Array.isArray(results) || results.length === 0) return;

    const list = this.getLeaderboard();

    for (const r of results) {
      if (!r.profile || !r.profile.name) continue;

      const playerName = r.profile.name.trim();
      let record = list.find(entry => entry.name.toLowerCase() === playerName.toLowerCase());

      if (!record) {
        record = {
          name: playerName,
          avatar: r.profile.avatar || 'avatar-1',
          color: r.profile.color || '#2563EB',
          totalScore: 0,
          highScore: 0,
          songsPlayed: 0,
          lastPlayed: Date.now()
        };
        list.push(record);
      }

      // Update cumulative stats
      record.totalScore += Math.round(r.score || 0);
      record.songsPlayed += 1;
      record.highScore = Math.max(record.highScore, Math.round(r.score || 0));
      record.avatar = r.profile.avatar || record.avatar;
      record.color = r.profile.color || record.color;
      record.lastPlayed = Date.now();
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('[Leaderboard] Error saving storage:', e);
    }
  }

  static resetLeaderboard() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('[Leaderboard] Error clearing storage:', e);
    }
  }
}

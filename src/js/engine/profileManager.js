/**
 * Player Profiles and Game Modes Management for Vocaluxe Web.
 * Supports up to 4 simultaneous players with independent colors, avatars, and difficulty.
 */

export class ProfileManager {
  static STORAGE_KEY = 'vocaluxe_player_profiles';
  static ACTIVE_PLAYERS_COUNT_KEY = 'vocaluxe_player_count';

  static DEFAULT_PROFILES = [
    {
      id: 'p1',
      name: 'Jugador 1',
      difficulty: 'normal',
      avatar: 'avatar-1',
      role: 'normal',
      active: true,
      color: '#2563EB', // Blue
      channel: 0
    },
    {
      id: 'p2',
      name: 'Jugador 2',
      difficulty: 'normal',
      avatar: 'avatar-2',
      role: 'normal',
      active: true,
      color: '#EF4444', // Red
      channel: 1
    },
    {
      id: 'p3',
      name: 'Jugador 3',
      difficulty: 'normal',
      avatar: 'avatar-3',
      role: 'normal',
      active: true,
      color: '#10B981', // Green
      channel: 0
    },
    {
      id: 'p4',
      name: 'Jugador 4',
      difficulty: 'normal',
      avatar: 'avatar-4',
      role: 'normal',
      active: true,
      color: '#F59E0B', // Amber
      channel: 1
    }
  ];

  static getProfiles() {
    try {
      const stored = localStorage.getItem(ProfileManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
        // If fewer than 4, fill with default profiles so 4 players are always supported
        const merged = Array.isArray(parsed) ? [...parsed] : [];
        for (let i = merged.length; i < ProfileManager.DEFAULT_PROFILES.length; i++) {
          merged.push(ProfileManager.DEFAULT_PROFILES[i]);
        }
        ProfileManager.saveProfiles(merged);
        return merged;
      }
    } catch (e) {
      console.warn('Error reading profiles:', e);
    }
    ProfileManager.saveProfiles(ProfileManager.DEFAULT_PROFILES);
    return ProfileManager.DEFAULT_PROFILES;
  }

  static saveProfiles(profiles) {
    try {
      localStorage.setItem(ProfileManager.STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.warn('Error saving profiles:', e);
    }
  }

  static getPlayerCount() {
    return parseInt(localStorage.getItem(ProfileManager.ACTIVE_PLAYERS_COUNT_KEY), 10) || 1;
  }

  static setPlayerCount(count) {
    localStorage.setItem(ProfileManager.ACTIVE_PLAYERS_COUNT_KEY, count);
  }

  static getActiveProfiles() {
    const all = ProfileManager.getProfiles();
    const count = ProfileManager.getPlayerCount();
    return all.slice(0, count);
  }

  static getDifficultyTolerance(difficulty) {
    switch (difficulty) {
      case 'easy':
        return 1.8;
      case 'hard':
        return 0.6;
      case 'normal':
      default:
        return 1.1;
    }
  }
}

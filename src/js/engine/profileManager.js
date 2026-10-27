/**
 * Player Profiles and Game Modes Management for Vocaluxe Web.
 * Persists user profiles, avatars, roles, and difficulty levels in localStorage.
 */

export class ProfileManager {
  static STORAGE_KEY = 'vocaluxe_player_profiles';
  static ACTIVE_MODE_KEY = 'vocaluxe_game_mode';

  static DEFAULT_PROFILES = [
    {
      id: 'p1',
      name: 'Jugador 1',
      difficulty: 'normal', // 'easy' | 'normal' | 'hard'
      avatar: 'avatar-1',
      role: 'normal',
      active: true,
      color: '#2563EB',     // Blue
      channel: 0            // Audio channel / Mic 1
    },
    {
      id: 'p2',
      name: 'Jugador 2',
      difficulty: 'normal',
      avatar: 'avatar-2',
      role: 'normal',
      active: false,
      color: '#EF4444',     // Red
      channel: 1            // Audio channel / Mic 2
    },
    {
      id: 'p3',
      name: 'Jugador 3',
      difficulty: 'normal',
      avatar: 'avatar-3',
      role: 'guest',
      active: false,
      color: '#10B981',     // Green
      channel: 0
    }
  ];

  static getProfiles() {
    try {
      const stored = localStorage.getItem(ProfileManager.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Error reading profiles from localStorage:', e);
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

  static getActiveProfiles() {
    const all = ProfileManager.getProfiles();
    const active = all.filter(p => p.active);
    return active.length > 0 ? active : [all[0]];
  }

  static getGameMode() {
    return localStorage.getItem(ProfileManager.ACTIVE_MODE_KEY) || 'solo'; // 'solo' | 'battle' | 'duet'
  }

  static setGameMode(mode) {
    localStorage.setItem(ProfileManager.ACTIVE_MODE_KEY, mode);
  }

  /**
   * Returns tolerance in semitones according to player difficulty setting.
   */
  static getDifficultyTolerance(difficulty) {
    switch (difficulty) {
      case 'easy':
        return 1.8; // Permissive
      case 'hard':
        return 0.6; // Strict precision
      case 'normal':
      default:
        return 1.1; // Standard Vocaluxe
    }
  }
}

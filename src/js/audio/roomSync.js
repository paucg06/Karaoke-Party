/**
 * Room Synchronization Manager for Mobile Microphones.
 * Handles BroadcastChannel and LocalStorage events for P2P mobile connections.
 */

export class RoomSync {
  constructor(onPlayerJoin, onPlayerLeave, onPlayerPitch) {
    this.onPlayerJoin = onPlayerJoin;
    this.onPlayerLeave = onPlayerLeave;
    this.onPlayerPitch = onPlayerPitch;

    this.channel = null;
    this.connectedMics = new Map(); // id -> { name, avatar, color, pitch, volume, isSinging, lastSeen }

    this.init();
  }

  init() {
    try {
      this.channel = new BroadcastChannel('karaoke_room_sync');
      this.channel.onmessage = (e) => this.handleMessage(e.data);
    } catch (err) {
      console.warn('BroadcastChannel not supported, using storage events:', err);
    }

    // Storage event fallback (for cross-window on same origin)
    window.addEventListener('storage', (e) => {
      if (e.key === 'karaoke_room_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          this.handleMessage(data);
        } catch (err) {}
      }
    });

    // Clean inactive mics every 5 seconds
    setInterval(() => {
      const now = Date.now();
      for (const [id, mic] of this.connectedMics.entries()) {
        if (now - mic.lastSeen > 10000) {
          this.connectedMics.delete(id);
          if (this.onPlayerLeave) this.onPlayerLeave(id);
        }
      }
    }, 5000);
  }

  handleMessage(data) {
    if (!data || !data.type) return;

    if (data.type === 'player_join') {
      const mic = {
        id: data.id,
        name: data.name,
        avatar: data.avatar || 'avatar-1',
        color: data.color || '#2563EB',
        pitch: null,
        volume: 0,
        isSinging: false,
        lastSeen: Date.now()
      };
      this.connectedMics.set(data.id, mic);
      if (this.onPlayerJoin) this.onPlayerJoin(mic);
    } else if (data.type === 'player_leave') {
      this.connectedMics.delete(data.id);
      if (this.onPlayerLeave) this.onPlayerLeave(data.id);
    } else if (data.type === 'player_pitch') {
      const mic = this.connectedMics.get(data.id);
      if (mic) {
        mic.pitch = data.pitch;
        mic.volume = data.volume;
        mic.isSinging = data.isSinging;
        mic.lastSeen = Date.now();
        if (this.onPlayerPitch) this.onPlayerPitch(data.id, data.pitch, data.volume, data.isSinging);
      }
    }
  }

  getConnectedPlayers() {
    return Array.from(this.connectedMics.values());
  }
}

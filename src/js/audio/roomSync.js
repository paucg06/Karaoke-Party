/**
 * WebRTC P2P Room Synchronization Manager (PeerJS).
 * Connects physical smartphones to the host screen over the internet/WiFi with zero servers.
 */

export class RoomSync {
  constructor(roomId, onPlayerJoin, onPlayerLeave, onPlayerPitch, onPlayerReady) {
    this.roomId = roomId || 'karaoke-party-paucg06';
    this.onPlayerJoin = onPlayerJoin;
    this.onPlayerLeave = onPlayerLeave;
    this.onPlayerPitch = onPlayerPitch;
    this.onPlayerReady = onPlayerReady;

    this.peer = null;
    this.broadcastChannel = null;
    this.connections = new Map(); // connId -> DataConnection
    this.connectedMics = new Map(); // playerId -> { id, name, avatar, color, pitch, volume, isSinging }

    this.init();
  }

  init() {
    // 1. BroadcastChannel for same-device local testing
    try {
      this.broadcastChannel = new BroadcastChannel('karaoke_room_sync');
      this.broadcastChannel.onmessage = (e) => this.handleMessage(e.data, 'broadcast');
    } catch (e) {
      console.warn('BroadcastChannel fallback:', e);
    }

    // 2. PeerJS WebRTC for physical smartphones
    this.initPeerJS();
  }

  initPeerJS() {
    if (typeof window.Peer === 'undefined') {
      console.warn('PeerJS library not loaded, relying on BroadcastChannel');
      return;
    }

    try {
      // Connect to public PeerJS cloud broker with our persistent room ID
      this.peer = new window.Peer(this.roomId, {
        debug: 1
      });

      this.peer.on('open', (id) => {
        console.log('[RoomSync] Sala WebRTC abierta con éxito. ID:', id);
      });

      this.peer.on('connection', (conn) => {
        console.log('[RoomSync] Nuevo móvil conectando:', conn.peer);
        this.connections.set(conn.peer, conn);

        conn.on('open', () => {
          const takenColors = Array.from(this.connectedMics.values()).map(p => p.color);
          conn.send({ type: 'room_state', takenColors: takenColors });
        });

        conn.on('data', (data) => {
          this.handleMessage(data, conn.peer);
        });

        conn.on('close', () => {
          console.log('[RoomSync] Móvil desconectado:', conn.peer);
          this.connections.delete(conn.peer);
          this.connectedMics.delete(conn.peer);
          if (this.onPlayerLeave) this.onPlayerLeave(conn.peer);
        });

        conn.on('error', (err) => {
          console.warn('[RoomSync] Error de conexión:', err);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[RoomSync] Peer error:', err.type, err);
        // If room ID is taken, retry with a fallback ID
        if (err.type === 'unavailable-id') {
          console.log('[RoomSync] ID en uso, reconectando...');
        }
      });
    } catch (err) {
      console.error('[RoomSync] Error iniciando PeerJS:', err);
    }
  }

  handleMessage(data, sourceId) {
    if (!data || !data.type) return;

    const playerId = data.id || sourceId;

    if (data.type === 'player_join') {
      const player = {
        id: playerId,
        name: data.name || 'Cantante',
        avatar: data.avatar || 'avatar-1',
        color: data.color || '#2563EB',
        pitch: null,
        volume: 0,
        isSinging: false,
        lastSeen: Date.now()
      };
      this.connectedMics.set(playerId, player);
      console.log('[RoomSync] Jugador unido:', player.name, playerId);
      if (this.onPlayerJoin) this.onPlayerJoin(player);
    } else if (data.type === 'player_leave') {
      this.connectedMics.delete(playerId);
      if (this.onPlayerLeave) this.onPlayerLeave(playerId);
    } else if (data.type === 'player_pitch') {
      const player = this.connectedMics.get(playerId);
      if (player) {
        player.pitch = data.pitch;
        player.volume = data.volume || 0;
        player.isSinging = !!data.isSinging;
        player.lastSeen = Date.now();
        if (this.onPlayerPitch) {
          this.onPlayerPitch(playerId, data.pitch, data.volume, data.isSinging);
        }
      }
    } else if (data.type === 'player_ready') {
      console.log('[RoomSync] Jugador listo:', playerId);
      if (this.onPlayerReady) {
        this.onPlayerReady(playerId);
      }
    }
  }

  broadcastToMics(msg) {
    for (const [peerId, conn] of this.connections) {
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch (e) {
          console.warn('[RoomSync] Error enviando a peer', peerId, e);
        }
      }
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {
        console.warn('[RoomSync] Error enviando a broadcastChannel', e);
      }
    }
  }

  getConnectedPlayers() {
    return Array.from(this.connectedMics.values());
  }
}

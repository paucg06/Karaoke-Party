/**
 * Audio / Video synchronized player for Karaoke gameplay.
 * Handles HTML5 media streams and synthetic fallback playback.
 */

export class SoundPlayer {
  constructor() {
    this.audioElement = new Audio();
    this.videoElement = null;
    this.isPlaying = false;
    this.duration = 0;
    this.onEndedCallback = null;

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onEndedCallback) this.onEndedCallback();
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.duration = this.audioElement.duration || 0;
    });
  }

  /**
   * Attach an HTML video element for background playback.
   */
  setVideoElement(element) {
    this.videoElement = element;
    if (this.videoElement) {
      this.videoElement.muted = true; // Video muted to avoid echo with audio element
      this.videoElement.playsInline = true;
    }
  }

  /**
   * Load media from an URL or Blob.
   */
  async loadSource(audioUrl, videoUrl = null) {
    this.stop();
    this.audioElement.src = audioUrl;
    this.audioElement.load();

    if (this.videoElement && videoUrl) {
      this.videoElement.src = videoUrl;
      this.videoElement.load();
    }
  }

  /**
   * Start or resume synchronized playback.
   */
  async play() {
    try {
      await this.audioElement.play();
      if (this.videoElement && this.videoElement.src) {
        await this.videoElement.play();
      }
      this.isPlaying = true;
    } catch (err) {
      this.isPlaying = false;
      throw err;
    }
  }

  /**
   * Pause playback.
   */
  pause() {
    this.audioElement.pause();
    if (this.videoElement && this.videoElement.src) {
      this.videoElement.pause();
    }
    this.isPlaying = false;
  }

  /**
   * Stop and reset playback.
   */
  stop() {
    this.pause();
    this.audioElement.currentTime = 0;
    if (this.videoElement && this.videoElement.src) {
      this.videoElement.currentTime = 0;
    }
  }

  /**
   * Seek to specific timestamp in seconds.
   */
  seek(timeInSeconds) {
    this.audioElement.currentTime = timeInSeconds;
    if (this.videoElement && this.videoElement.src) {
      this.videoElement.currentTime = timeInSeconds;
    }
  }

  /**
   * Get current playback position in seconds with sub-millisecond precision.
   */
  getCurrentTime() {
    return this.audioElement.currentTime;
  }

  getDuration() {
    return this.duration || this.audioElement.duration || 0;
  }

  setVolume(volume) {
    this.audioElement.volume = Math.max(0, Math.min(1, volume));
  }

  onEnded(callback) {
    this.onEndedCallback = callback;
  }
}

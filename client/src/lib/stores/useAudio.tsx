import { create } from "zustand";

interface AudioState {
  backgroundMusic: HTMLAudioElement | null;
  hitSound: HTMLAudioElement | null;
  successSound: HTMLAudioElement | null;
  isMuted: boolean;
  masterVolume: number;
  previousVolume: number;

  // Setter functions
  setBackgroundMusic: (music: HTMLAudioElement) => void;
  setHitSound: (sound: HTMLAudioElement) => void;
  setSuccessSound: (sound: HTMLAudioElement) => void;

  // Control functions
  toggleMute: () => void;
  setVolume: (volume: number) => void;
  playHit: () => void;
  playSuccess: () => void;
}

export const useAudio = create<AudioState>((set, get) => ({
  backgroundMusic: null,
  hitSound: null,
  successSound: null,
  isMuted: true, 
  masterVolume: 0,
  previousVolume: 0.7,

  setBackgroundMusic: (music) => set({ backgroundMusic: music }),
  setHitSound: (sound) => set({ hitSound: sound }),
  setSuccessSound: (sound) => set({ successSound: sound }),
  setVolume: (volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const { backgroundMusic, hitSound, successSound } = get();

    if (backgroundMusic) backgroundMusic.volume = clampedVolume;
    if (hitSound) hitSound.volume = clampedVolume;
    if (successSound) successSound.volume = clampedVolume;

    set((state) => ({
      masterVolume: clampedVolume,
      isMuted: clampedVolume === 0,
      previousVolume: clampedVolume > 0 ? clampedVolume : state.previousVolume,
    }));
  },

  toggleMute: () => {
    const { isMuted, previousVolume, setVolume } = get();
    setVolume(isMuted ? previousVolume : 0);
  },

  playHit: () => {
    const { hitSound, isMuted, masterVolume } = get();
    if (hitSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Hit sound skipped (muted)");
        return;
      }

      // Clone the sound to allow overlapping playback
      const soundClone = hitSound.cloneNode() as HTMLAudioElement;
      soundClone.volume = Math.max(0.1, masterVolume * 0.5);
      soundClone.play().catch(error => {
        console.log("Hit sound play prevented:", error);
      });
    }
  },

  playSuccess: () => {
    const { successSound, isMuted, masterVolume } = get();
    if (successSound) {
      // If sound is muted, don't play anything
      if (isMuted) {
        console.log("Success sound skipped (muted)");
        return;
      }

      successSound.currentTime = 0;
      successSound.volume = masterVolume;
      successSound.play().catch(error => {
        console.log("Success sound play prevented:", error);
      });
    }
  }
}));

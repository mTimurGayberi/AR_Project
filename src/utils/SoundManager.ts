/**
 * SoundManager
 * 
 * Centralized Web Audio API sound system for all 10 AR mini-games.
 * Handles:
 * - iOS Safari / DuckDuckGo AudioContext unlocking on Launch / first tap.
 * - Zero-latency one-shot SFX:
 *     - level_start.mp3
 *     - level_finish.mp3
 *     - orb_pick_up.mp3
 *     - wall_collision.mp3
 * - Looping background & 3D proximity audio:
 *     - ambientMaze.mp3 (loops while MazeGame is active)
 *     - orb_loop.mp3    (loops while Gem is active, volume scales with player distance!)
 * - Musical tone synthesis for Simon buttons/lamps.
 */

export type SoundKey =
    | 'level_start'
    | 'level_finish'
    | 'orb_loop'
    | 'orb_pick_up'
    | 'ambientMaze'
    | 'wall_collision';

const SOUND_URLS: Record<SoundKey, string> = {
    level_start:    new URL('../sounds/level_start.mp3', import.meta.url).toString(),
    level_finish:   new URL('../sounds/level_finish.mp3', import.meta.url).toString(),
    orb_loop:       new URL('../sounds/orb_loop.mp3', import.meta.url).toString(),
    orb_pick_up:    new URL('../sounds/orb_pick_up.mp3', import.meta.url).toString(),
    ambientMaze:    new URL('../sounds/ambientMaze.mp3', import.meta.url).toString(),
    wall_collision: new URL('../sounds/wall_collision.mp3', import.meta.url).toString(),
};

interface ActiveLoop {
    source: AudioBufferSourceNode;
    gainNode: GainNode;
}

export class SoundManager {
    private static instance: SoundManager;

    // #region VOLUME & TUNING CONFIGURATION
    public masterVolume: number = 1.0;
    public ambientMazeVolume: number = 0.35;
    public orbMinVolume: number = 0.08;
    public orbMaxVolume: number = 0.75;
    public orbMaxHearDistance: number = 8.0; // Distance in meters where orb hum begins ramping up
    // #endregion

    private ctx: AudioContext | null = null;
    private buffers: Map<SoundKey, AudioBuffer> = new Map();
    private loadingPromises: Map<SoundKey, Promise<AudioBuffer | null>> = new Map();
    private activeLoops: Map<SoundKey, ActiveLoop> = new Map();
    private isUnlocked: boolean = false;
    private isMuted: boolean = false;

    // Simon musical frequencies (C5, E5, G5, C6)
    private readonly simonFrequencies = [523.25, 659.25, 783.99, 1046.50];

    private constructor() {
        this.setupTouchUnlock();
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    // #region INITIALIZATION & IOS UNLOCK
    private getContext(): AudioContext | null {
        if (typeof window === 'undefined') return null;
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        return this.ctx;
    }

    private setupTouchUnlock(): void {
        if (typeof window === 'undefined') return;

        const unlock = () => {
            this.unlockAndPreload();
        };

        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('touchstart', unlock, { passive: true });
        window.addEventListener('click', unlock, { passive: true });
    }

    /**
     * Call on [Launch] button click or first user interaction to unlock iOS WebAudio and preload all 6 MP3s.
     */
    public unlockAndPreload(): void {
        const ctx = this.getContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        if (!this.isUnlocked) {
            this.isUnlocked = true;
            (Object.keys(SOUND_URLS) as SoundKey[]).forEach((key) => {
                this.loadSound(key);
            });
        }
    }

    private loadSound(key: SoundKey): Promise<AudioBuffer | null> {
        if (this.buffers.has(key)) {
            return Promise.resolve(this.buffers.get(key)!);
        }
        if (this.loadingPromises.has(key)) {
            return this.loadingPromises.get(key)!;
        }

        const ctx = this.getContext();
        if (!ctx) return Promise.resolve(null);

        const url = SOUND_URLS[key];
        const promise = fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.arrayBuffer();
            })
            .then((arrayBuf) => ctx.decodeAudioData(arrayBuf))
            .then((audioBuf) => {
                this.buffers.set(key, audioBuf);
                return audioBuf;
            })
            .catch((err) => {
                console.warn(`[SoundManager] Could not load '${key}' (${url}):`, err);
                return null;
            });

        this.loadingPromises.set(key, promise);
        return promise;
    }
    // #endregion

    // #region ONE-SHOT SOUND EFFECTS
    public playOneShot(key: SoundKey, volume: number = 0.85, playbackRate: number = 1.0): void {
        if (this.isMuted) return;
        const ctx = this.getContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const playBuffer = (buffer: AudioBuffer) => {
            try {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.playbackRate.value = playbackRate;

                const gainNode = ctx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1, volume * this.masterVolume));

                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                source.start(0);
            } catch (e) {
                console.warn(`[SoundManager] Failed playing '${key}':`, e);
            }
        };

        const existing = this.buffers.get(key);
        if (existing) {
            playBuffer(existing);
        } else {
            this.loadSound(key).then((buf) => {
                if (buf) playBuffer(buf);
            });
        }
    }

    public playLevelStart(): void {
        this.playOneShot('level_start', 0.85);
    }

    public playLevelFinish(): void {
        this.playOneShot('level_finish', 0.95);
    }

    public playOrbPickUp(): void {
        this.stopOrbLoop();
        this.playOneShot('orb_pick_up', 0.95);
    }

    public playWallCollision(): void {
        this.playOneShot('wall_collision', 0.9);
    }
    // #endregion

    // #region LOOPING SOUNDS (AMBIENT MAZE & ORB PROXIMITY LOOP)
    public startLoop(key: SoundKey, initialVolume: number = 0.35): void {
        if (this.isMuted) return;
        if (this.activeLoops.has(key)) return; // Already playing!

        const ctx = this.getContext();
        if (!ctx) return;

        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        const startWithBuffer = (buffer: AudioBuffer) => {
            if (this.activeLoops.has(key)) return;
            try {
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.loop = true;

                const gainNode = ctx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1, initialVolume * this.masterVolume));

                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                source.start(0);

                this.activeLoops.set(key, { source, gainNode });
            } catch (e) {
                console.warn(`[SoundManager] Failed starting loop '${key}':`, e);
            }
        };

        const existing = this.buffers.get(key);
        if (existing) {
            startWithBuffer(existing);
        } else {
            this.loadSound(key).then((buf) => {
                if (buf) startWithBuffer(buf);
            });
        }
    }

    public stopLoop(key: SoundKey): void {
        const active = this.activeLoops.get(key);
        if (!active) return;
        try {
            active.source.stop();
            active.source.disconnect();
            active.gainNode.disconnect();
        } catch (e) {}
        this.activeLoops.delete(key);
    }

    public stopAllLoops(): void {
        Array.from(this.activeLoops.keys()).forEach((key) => this.stopLoop(key));
    }

    public startAmbientMaze(): void {
        this.startLoop('ambientMaze', this.ambientMazeVolume);
    }

    public stopAmbientMaze(): void {
        this.stopLoop('ambientMaze');
    }

    public startOrbLoop(): void {
        this.startLoop('orb_loop', this.orbMinVolume);
    }

    public stopOrbLoop(): void {
        this.stopLoop('orb_loop');
    }

    /**
     * Dynamically scales the volume of `orb_loop.mp3` based on how close the player is to the Gem!
     */
    public updateOrbProximity(distanceMeters: number): void {
        if (this.isMuted) return;
        if (!this.activeLoops.has('orb_loop')) {
            this.startOrbLoop();
            return;
        }
        const loop = this.activeLoops.get('orb_loop');
        if (!loop) return;

        // Closeness factor: 1.0 when right next to gem (<= 1.2m), 0.0 when >= orbMaxHearDistance (8m)
        const t = 1 - Math.max(0, Math.min(1, (distanceMeters - 1.2) / (this.orbMaxHearDistance - 1.2)));
        const targetVol = this.orbMinVolume + t * (this.orbMaxVolume - this.orbMinVolume);
        loop.gainNode.gain.value = targetVol * this.masterVolume;
    }
    // #endregion

    // #region SIMON MUSICAL TONES
    /**
     * Plays a crisp musical synth chime for Simon lamps/buttons (or error buzz on wrong button).
     */
    public playSimonTone(buttonIndex: number, isError: boolean = false): void {
        if (this.isMuted) return;
        if (isError) {
            this.playWallCollision();
            return;
        }

        const ctx = this.getContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
        }

        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const freq = this.simonFrequencies[buttonIndex % this.simonFrequencies.length] || 523.25;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.32 * this.masterVolume, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {}
    }
    // #endregion
}

export const soundManager = SoundManager.getInstance();

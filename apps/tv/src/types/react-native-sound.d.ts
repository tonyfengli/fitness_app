declare module 'react-native-sound' {
  export default class Sound {
    static setCategory(category: string): void;
    static MAIN_BUNDLE: number;

    // Support both raw resources (basePath as number) and file paths (basePath as empty string)
    constructor(filename: string, basePath: number | string, callback: (error: Error | null) => void);

    play(callback?: (success: boolean) => void): void;
    stop(callback?: () => void): void;
    pause(callback?: () => void): void;
    release(): void;
    setVolume(volume: number): void;
    setCurrentTime(time: number): void;
    getCurrentTime(callback: (time: number, isPlaying: boolean) => void): void;
    getDuration(): number;
    isPlaying(): boolean;
  }
}
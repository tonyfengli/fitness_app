declare module 'react-native-sound' {
  export default class Sound {
    static setCategory(category: string): void;
    static MAIN_BUNDLE: number;
    
    constructor(filename: string, basePath: number, callback: (error: any) => void);
    
    play(callback?: (success: boolean) => void): void;
    stop(callback?: () => void): void;
    pause(callback?: () => void): void;
    release(): void;
    setVolume(volume: number): void;
    setCurrentTime(time: number): void;
    getCurrentTime(callback: (time: number) => void): void;
    getDuration(): number;
    isPlaying(): boolean;
  }
}
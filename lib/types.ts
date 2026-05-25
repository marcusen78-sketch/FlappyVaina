// Shared types for the Slingshot game

export interface SlingshotState {
  birdsLeft: number;
  score: number;
  phase: 'playing' | 'gameover' | 'win';
}

export interface SlingshotCallbacks {
  onStateChange: (state: SlingshotState) => void;
}

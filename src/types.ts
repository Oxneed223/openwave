export type Source = "audius" | "spotify" | "youtube";

export type RepeatMode = "off" | "all" | "one";

export interface Track {
  id: string;
  source: Source;
  title: string;
  artist: string;
  artwork?: string;
  /** Seconds. */
  duration: number;
  streamUrl: string;
  genre?: string;
  album?: string;
  permalink?: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  tracks: Track[];
}

export interface ToastMessage {
  id: number;
  message: string;
  tone: "info" | "success" | "error";
}

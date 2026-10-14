export type Status = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  name: string;
  color: string;
  status: Status;
  activity?: string;
  bot?: boolean;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  members: string[];
}

export type ChannelKind = 'text' | 'voice' | 'announcement';

export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind;
  topic?: string;
}

export interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

export interface Server {
  id: string;
  name: string;
  acronym: string;
  color: string;
  categories: Category[];
  roles: Role[];
}

export interface Message {
  id: string;
  authorId: string;
  /** Nome de quem escreveu, para autores fora do diretório local (pessoas das salas de voz). */
  authorName?: string;
  content: string;
  timestamp: number;
}

export interface DirectMessage {
  id: string;
  userId: string;
}

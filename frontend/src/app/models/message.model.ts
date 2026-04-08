export interface ChatMessage {
  CATEGORY: 'OPEN' | 'CLOSE' | 'EMISSION' | 'ROUTAGE';
  TARGET: string;
  SOURCE: string;
  TIMESTAMP: string;
  PAYLOAD: string;
}

export interface RcChannel {
  _id: string;
  name: string;
  t: string;
  usernames?: string[];
  lastMessage?: { msg: string; ts: string };
}

export interface RcMessage {
  _id: string;
  msg: string;
  u: { _id: string; username: string };
  ts: string;
  rid: string;
}

export interface UserSession {
  userId: string;
  authToken: string;
  username: string;
  wsUrl: string;
  rcUrl: string;
}

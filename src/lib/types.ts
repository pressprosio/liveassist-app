import type { ConvState } from './theme';

export interface NotifyPrefs {
  handoffs: boolean;
  new_chats: boolean;
  messages: 'mine' | 'all' | 'none';
}

export interface Agent {
  id: string; name: string; email: string; avatar: string | null; role: 'admin' | 'agent'; must_change_password: boolean;
  notify?: NotifyPrefs;
}

export interface ConversationSummary {
  id: string; site_id: string; site_name: string; state: ConvState; topic: string;
  name: string | null; email: string | null; page_url: string | null; page_title: string | null;
  agent_id: string | null; agent_name: string | null; last_activity_at: string; created_at: string;
  waiting_since: string | null; last_text: string | null; last_role: string | null;
}

export interface ChatMessage {
  id: string; role: 'visitor' | 'ai' | 'agent' | 'system'; text: string; ts: string;
  author?: { name: string; avatar?: string | null };
  pending?: boolean;
}

export interface Session { hubUrl: string; token: string; agent: Agent }

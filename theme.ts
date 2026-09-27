/** Design tokens shared by every screen. Matches the web console and the website widget. */
export const colors = {
  ink: '#17202C',
  muted: '#5D6877',
  line: '#E1E5EB',
  wash: '#F4F6F9',
  surface: '#FFFFFF',
  accent: '#1F5FBF',
  accentInk: '#FFFFFF',
  danger: '#B42318',
  wait: '#A15C00',
  waitBg: '#FFF3DC',
  live: '#11703F',
  liveBg: '#E3F5EA',
  ai: '#3B4A60',
  aiBg: '#E9EEF5',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const type = { small: 13, body: 16, title: 20, big: 28 };

export type ConvState = 'ai_active' | 'waiting_human' | 'human_active' | 'closed';

export const stateStyle: Record<ConvState, { label: string; fg: string; bg: string }> = {
  waiting_human: { label: 'Needs a person', fg: colors.wait, bg: colors.waitBg },
  human_active: { label: 'With a person', fg: colors.live, bg: colors.liveBg },
  ai_active: { label: 'AI answering', fg: colors.ai, bg: colors.aiBg },
  closed: { label: 'Ended', fg: colors.muted, bg: colors.wash },
};

export const topicLabel: Record<string, string> = { sales: 'Sales', technical: 'Technical', other: 'Other', auto: 'General' };

export type SessionMode = 'dm' | 'voice_room';

export interface DiscordEmojiConfig {
  id: string;
  name: string;
  animated?: boolean;
}

export interface DiscordLinkButtonConfig {
  type: 2;
  style: 5;
  label: string;
  url: string;
  emoji: DiscordEmojiConfig;
}

export interface DiscordActionRowConfig {
  type: 1;
  components: [DiscordLinkButtonConfig];
}

interface SessionActionButtonTemplate {
  label: string;
  emoji: DiscordEmojiConfig;
}

interface SessionActionButtonOptions {
  sessionMode?: string | null;
  guildId?: string | null;
  voiceChannelId?: string | null;
  discordUserId?: string | null;
}

const SESSION_ACTION_BUTTON_TEMPLATES: Record<SessionMode, SessionActionButtonTemplate> = {
  voice_room: {
    label: '︲ลงห้องคุย',
    emoji: { id: '1360987538793168986', name: 'midsiry_emoji1', animated: true },
  },
  dm: {
    label: '︲ทักแชทส่วนตัว',
    emoji: { id: '1451219108531277826', name: '7759pepebeg', animated: true },
  },
};

export function normalizeSessionMode(sessionMode?: string | null): SessionMode {
  return sessionMode === 'voice_room' ? 'voice_room' : 'dm';
}

export function getSessionActionButtonTemplate(sessionMode?: string | null): SessionActionButtonTemplate {
  return SESSION_ACTION_BUTTON_TEMPLATES[normalizeSessionMode(sessionMode)];
}

export function buildSessionActionRow(
  options: SessionActionButtonOptions,
): DiscordActionRowConfig | null {
  const sessionMode = normalizeSessionMode(options.sessionMode);
  const template = getSessionActionButtonTemplate(sessionMode);

  const url = sessionMode === 'voice_room'
    ? options.guildId && options.voiceChannelId
      ? `https://discord.com/channels/${options.guildId}/${options.voiceChannelId}`
      : null
    : options.discordUserId
      ? `https://discord.com/users/${options.discordUserId}`
      : null;

  if (!url) {
    return null;
  }

  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 5,
        label: template.label,
        url,
        emoji: template.emoji,
      },
    ],
  };
}

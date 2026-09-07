import React from 'react';
import { ExternalLink, Sparkles, ChevronDown, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// Types
// ============================================================================

export interface NormalizedPayload {
  content?: string;
  embeds?: any[];
  components?: any[];
  flags?: number;
  [key: string]: any;
}

export interface NormalizeResult {
  isValid: boolean;
  normalized: NormalizedPayload | null;
  error?: string;
  warnings?: string[];
  stats: {
    hasContent: boolean;
    hasEmbeds: boolean;
    embedCount: number;
    hasComponents: boolean;
    componentCount: number;
    wasUnwrapped: boolean;
    fixedLinkButtonsCount: number;
  };
}

// ============================================================================
// Color Formatter Helper
// ============================================================================

export function formatDiscordColor(color: any, defaultColor = '#F59E0B'): string {
  if (!color) return defaultColor;
  if (typeof color === 'string') {
    const trimmed = color.trim();
    if (trimmed.startsWith('#')) return trimmed;
    const parsed = parseInt(trimmed, 16);
    if (!isNaN(parsed)) return `#${parsed.toString(16).padStart(6, '0')}`;
    return defaultColor;
  }
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  return defaultColor;
}

// ============================================================================
// AI Prompt Helper
// ============================================================================

export const DISCORD_AI_PROMPT_TEMPLATE = `คุณเป็น AI ผู้เชี่ยวชาญด้าน Discord API และโครงสร้าง Discord Components v2
หน้าที่ของคุณคือรับข้อความ JSON ดิบของ Discord Component v2 หรือ Discohook ที่ส่งมาให้ แล้วทำการจัดรูปแบบ (Format) และแก้ไขข้อบกพร่องให้ได้โครงสร้าง JSON ที่ถูกต้องตามมาตรฐาน เพื่อสามารถใช้งานร่วมกับคำสั่ง channel.send() ของ Discord Bot ได้ทันทีโดยไม่มีข้อผิดพลาด (Error)

กรุณาแปลงข้อมูลตามกฎด้านล่างนี้อย่างเคร่งครัด:

1. ลบส่วนห่อหุ้มที่ไม่เกี่ยวข้อง (Wrapper & Metadata):
   - ดึงคีย์ "flags" และ "components" ออกมาจากภายใต้คีย์ "data" หรือคีย์อื่น ๆ ขึ้นมาอยู่ที่ระดับสูงสุด (Root Level)
   - ลบคีย์ "_id" หรือคีย์อื่น ๆ ที่ไม่ได้เป็นค่ามาตรฐานของ Discord Message Payload ออกไป

2. แก้ไขข้อผิดพลาดทางเทคนิคของปุ่มลิงก์ (Link Button - Style 5):
   - ตรวจสอบปุ่มใดก็ตามที่มี "type": 2 และ "style": 5 (หรือปุ่มที่มี url)
   - ต้องทำการลบคีย์ "custom_id" ออกจากปุ่มเหล่านั้นเสมอ (เนื่องจาก Discord API ห้ามมี custom_id ในปุ่มลิงก์โดยเด็ดขาด มิฉะนั้นจะเกิด Error BUTTON_COMPONENT_CUSTOM_ID_URL_MUTUALLY_EXCLUSIVE ทันที)

3. ตรวจสอบความสมบูรณ์ของ JSON:
   - ตรวจสอบว่าอักขระพิเศษในเนื้อหาข้อความ เช่น เครื่องหมายอัญประกาศคู่ ("), การขึ้นบรรทัดใหม่ (\\n), หรือสัญลักษณ์ต่าง ๆ ได้รับการ Escape ไว้อย่างถูกต้องจนเป็น Valid JSON 100%

4. คงรูปแบบตัวแปรและข้อมูลเฉพาะตัวเอาไว้:
   - ห้ามลบตัวแปร เช่น <@0>, เครื่องหมายอีโมจิ Discord เช่น <:name:123456789> หรือ <a:name:123456789> ให้คงไว้เหมือนเดิมทุกประการ

เมื่อเข้าใจกติกาแล้ว กรุณาแปลงข้อมูล JSON ต่อไปนี้ให้เสร็จสิ้นและตอบกลับเฉพาะโค้ด JSON ที่ถูกต้องเท่านั้น:

[ใส่ข้อความ JSON ดิบของคุณตรงนี้]`;

// ============================================================================
// Sample Presets
// ============================================================================

export const CAMPAIGN_JSON_PRESETS = [
  {
    id: 'component-v2-announcement',
    name: '📢 ประกาศโปรโมชั่น (Component v2)',
    description: 'การ์ดคอนเทนเนอร์พร้อมหัวข้อ เส้นคั่น และปุ่มลิงก์ภายนอก',
    json: JSON.stringify(
      {
        flags: 32768,
        components: [
          {
            type: 17,
            components: [
              {
                type: 10,
                content: '## 📢 **โปรโมชั่นต้อนรับสมาชิกใหม่!**\nยินดีต้อนรับสู่ **Bear Cafe** รับสิทธิพิเศษและกิจกรรมแจกของรางวัลทุกสัปดาห์ 🐻✨\n\n- สั่งกาแฟและเครื่องดื่มสุดพิเศษ\n- สะสมแต้มแลกยศและของรางวัล\n- ห้องพูดคุยและหาเพื่อนเล่นเกมตลอด 24 ชม.',
              },
              {
                type: 14,
                divider: true,
                spacing: 2,
              },
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 5,
                    label: 'สำรวจเว็บไซต์ Bear Cafe',
                    url: 'https://bearcafe.app',
                  },
                  {
                    type: 2,
                    style: 5,
                    label: 'รับยศฟรี',
                    url: 'https://bearcafe.app/checkin',
                  },
                ],
              },
            ],
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'embed-event',
    name: '🎉 การ์ดกิจกรรม Embed สวยงาม',
    description: 'Discord Embed พร้อมสีขอบ แบนเนอร์ และฟิลด์ข้อมูล',
    json: JSON.stringify(
      {
        content: '🌟 **กิจกรรมพิเศษประจำสัปดาห์เริ่มขึ้นแล้ว!** 🌟',
        embeds: [
          {
            title: '🏆 ทัวร์นาเมนต์มินิเกมชิงรางวัล Bear Cafe',
            description: 'ขอเชิญเพื่อนๆ ทุกคนร่วมสนุกกับกิจกรรมสะสมแต้มประจำสัปดาห์ ลุ้นรับยศพิเศษและของสะสมสุดน่ารัก 🐻🍯',
            color: 16103179, // Amber/Gold #F59E0B
            fields: [
              {
                name: '📅 ระยะเวลากิจกรรม',
                value: 'ทุกวันเสาร์ - อาทิตย์ เวลา 20:00 น.',
                inline: true,
              },
              {
                name: '🎁 ของรางวัล',
                value: 'ยศพิเศษ Bear VIP & แสตมป์สะสม',
                inline: true,
              },
            ],
            footer: {
              text: 'Bear Cafe • บรรยากาศอบอุ่นเหมือนบ้าน',
            },
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'simple-text-with-buttons',
    name: '💬 ข้อความพร้อมปุ่มลิงก์ (Action Row)',
    description: 'ข้อความธรรมดารองรับ Discord Markdown พร้อมปุ่ม Action Row',
    json: JSON.stringify(
      {
        content: '☕ **สวัสดีตอนบ่ายค่ะทุกคน!**\nอย่าลืมแวะมารับคะแนนเช็กอินประจำวันกันนะคะ แค่คลิกปุ่มด้านล่างนี้ได้เลยค่ะ ✨',
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 5,
                label: 'เช็กอินรับแต้ม 🍯',
                url: 'https://bearcafe.app/checkin',
              },
              {
                type: 2,
                style: 5,
                label: 'ดูกระดานอันดับ 📊',
                url: 'https://bearcafe.app',
              },
            ],
          },
        ],
      },
      null,
      2
    ),
  },
];

// ============================================================================
// Sanitizer
// ============================================================================

export function sanitizeComponentsDeep(item: any, counters: { fixedLinkButtons: number }): any {
  if (!item || typeof item !== 'object') return item;
  if (Array.isArray(item)) {
    return item.map((sub) => sanitizeComponentsDeep(sub, counters));
  }

  const copy = { ...item };

  // Remove Discohook internal ID
  delete copy._id;

  // Handle Button (type 2)
  const isButton = copy.type === 2 || copy.type === 'button';
  if (isButton) {
    const isLink = copy.style === 5 || (typeof copy.url === 'string' && copy.url.trim() !== '');
    if (isLink) {
      if ('custom_id' in copy) {
        delete copy.custom_id;
        counters.fixedLinkButtons++;
      }
      copy.style = 5;
    } else {
      if (typeof copy.url === 'string' && copy.url.trim() === '') {
        delete copy.url;
      }
    }
  }

  // Recurse into children
  for (const key of Object.keys(copy)) {
    if (typeof copy[key] === 'object' && copy[key] !== null) {
      copy[key] = sanitizeComponentsDeep(copy[key], counters);
    }
  }

  return copy;
}

// ============================================================================
// Universal Normalizer: Tolerates ANY JSON payload format
// ============================================================================

export function normalizeDiscordPayload(rawInput: any): NormalizeResult {
  const stats = {
    hasContent: false,
    hasEmbeds: false,
    embedCount: 0,
    hasComponents: false,
    componentCount: 0,
    wasUnwrapped: false,
    fixedLinkButtonsCount: 0,
  };
  const warnings: string[] = [];

  let obj: any = rawInput;

  // 1. If string, parse JSON (with safe loop for multi-stringified JSON)
  if (typeof obj === 'string') {
    let loop = 0;
    while (typeof obj === 'string' && loop < 5) {
      loop++;
      const trimmed = obj.trim();
      if (!trimmed) {
        return {
          isValid: false,
          normalized: null,
          error: 'กรุณาระบุข้อความ JSON',
          stats,
        };
      }

      // If it doesn't look like JSON at all, treat as plain text content
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[') && !trimmed.startsWith('"')) {
        return {
          isValid: true,
          normalized: { content: trimmed },
          stats: {
            hasContent: true,
            hasEmbeds: false,
            embedCount: 0,
            hasComponents: false,
            componentCount: 0,
            wasUnwrapped: false,
            fixedLinkButtonsCount: 0,
          },
        };
      }

      try {
        obj = JSON.parse(trimmed);
      } catch (err: any) {
        // If JSON parse fails, treat as plain text content
        return {
          isValid: true,
          normalized: { content: trimmed },
          warnings: [`ข้อความถูกมองเป็น Plain Text เนื่องจากไม่ใช่รูปแบบ JSON ที่สมบูรณ์: ${err.message}`],
          stats: {
            hasContent: true,
            hasEmbeds: false,
            embedCount: 0,
            hasComponents: false,
            componentCount: 0,
            wasUnwrapped: false,
            fixedLinkButtonsCount: 0,
          },
        };
      }
    }
  }

  if (!obj || typeof obj !== 'object') {
    return {
      isValid: false,
      normalized: null,
      error: 'ไม่พบข้อมูลใน JSON',
      stats,
    };
  }

  // 2. Unwrap Discohook & nested wrappers recursively
  let unwrapAttempts = 0;
  while (unwrapAttempts < 5) {
    unwrapAttempts++;
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      obj = obj.data;
      stats.wasUnwrapped = true;
      warnings.push('ปลดโครงสร้าง "data" (จาก Discohook) ให้อัตโนมัติ');
      continue;
    }
    if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
      obj = obj.payload;
      stats.wasUnwrapped = true;
      continue;
    }
    if (obj.message && typeof obj.message === 'object' && !Array.isArray(obj.message)) {
      obj = obj.message;
      stats.wasUnwrapped = true;
      continue;
    }
    if (Array.isArray(obj.messages) && obj.messages.length > 0) {
      const first = obj.messages[0];
      obj = first.data || first.payload || first;
      stats.wasUnwrapped = true;
      warnings.push('ดึงข้อความแรกจากรายการ "messages" ให้อัตโนมัติ');
      continue;
    }
    if (Array.isArray(obj.backups) && obj.backups.length > 0) {
      const first = obj.backups[0];
      obj = first.messages?.[0]?.data || first.data || first;
      stats.wasUnwrapped = true;
      continue;
    }
    break;
  }

  // 3. If array directly
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return {
        isValid: false,
        normalized: null,
        error: 'Array ใน JSON ว่างเปล่า ไม่มีข้อมูลสำหรับส่ง',
        stats,
      };
    }
    const firstItem = obj[0];
    if (firstItem && typeof firstItem === 'object') {
      if ('type' in firstItem) {
        obj = { flags: 32768, components: obj };
        stats.wasUnwrapped = true;
      } else if ('title' in firstItem || 'description' in firstItem || 'fields' in firstItem) {
        obj = { embeds: obj };
        stats.wasUnwrapped = true;
      }
    }
  }

  // 4. If single component at root (e.g. type: 17 container, type: 1 action row)
  if (obj && typeof obj.type === 'number') {
    obj = { flags: 32768, components: [obj] };
    stats.wasUnwrapped = true;
  }

  // 5. If single embed at root (e.g. { title, description, fields } without embeds array)
  if (obj && !obj.embeds) {
    if (obj.embed && typeof obj.embed === 'object') {
      obj.embeds = [obj.embed];
      delete obj.embed;
      stats.wasUnwrapped = true;
    } else if (
      'title' in obj ||
      'description' in obj ||
      'fields' in obj ||
      'thumbnail' in obj ||
      'image' in obj ||
      'footer' in obj ||
      'author' in obj
    ) {
      const { content, text, body, ...embedFields } = obj;
      obj = {
        ...(content || text || body ? { content: content || text || body } : {}),
        embeds: [embedFields],
      };
      stats.wasUnwrapped = true;
    }
  }

  // 6. Text aliases
  if (!obj.content) {
    if (typeof obj.text === 'string') obj.content = obj.text;
    else if (typeof obj.body === 'string') obj.content = obj.body;
    else if (typeof obj.msg === 'string') obj.content = obj.msg;
  }

  // 7. Sanitize buttons (strip invalid custom_id on link buttons)
  const counters = { fixedLinkButtons: 0 };
  const sanitized = sanitizeComponentsDeep(obj, counters);
  stats.fixedLinkButtonsCount = counters.fixedLinkButtons;

  if (counters.fixedLinkButtons > 0) {
    warnings.push(
      `แก้ไขปุ่มลิงก์ (Style 5) จำนวน ${counters.fixedLinkButtons} ปุ่ม โดยลบคีย์ custom_id ที่ขัดแย้งกับ Discord API ออกให้แล้ว`
    );
  }

  // 8. Stats check
  if (typeof sanitized.content === 'string' && sanitized.content.trim().length > 0) {
    stats.hasContent = true;
  }

  if (Array.isArray(sanitized.embeds) && sanitized.embeds.length > 0) {
    stats.hasEmbeds = true;
    stats.embedCount = sanitized.embeds.length;
  }

  if (Array.isArray(sanitized.components) && sanitized.components.length > 0) {
    stats.hasComponents = true;
    stats.componentCount = sanitized.components.length;
    // Ensure flags: 32768 for Component v2
    const str = JSON.stringify(sanitized.components);
    if ((str.includes('"type":17') || str.includes('"type": 17') || str.includes('"type":10') || str.includes('"type": 10')) && !sanitized.flags) {
      sanitized.flags = 32768;
    }
  }

  if (!stats.hasContent && !stats.hasEmbeds && !stats.hasComponents) {
    return {
      isValid: false,
      normalized: null,
      error: 'JSON ต้องมีอย่างน้อย 1 รายการระหว่าง "components", "embeds" หรือ "content"',
      stats,
    };
  }

  return {
    isValid: true,
    normalized: sanitized,
    warnings: warnings.length > 0 ? warnings : undefined,
    stats,
  };
}

// ============================================================================
// Markdown & Discord Text Parser Component
// ============================================================================

export function parseDiscordMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const lines = text.split('\n');
  return lines.map((rawLine, lineIdx) => {
    let line = rawLine;
    let isH1 = false;
    let isH2 = false;
    let isH3 = false;
    let isSubtext = false;
    let isQuote = false;
    let isListItem = false;

    // Check Discord markdown headers & prefixes
    if (line.startsWith('### ')) {
      isH3 = true;
      line = line.substring(4);
    } else if (line.startsWith('## ')) {
      isH2 = true;
      line = line.substring(3);
    } else if (line.startsWith('# ')) {
      isH1 = true;
      line = line.substring(2);
    } else if (line.startsWith('-# ')) {
      isSubtext = true;
      line = line.substring(3);
    } else if (line.startsWith('> ')) {
      isQuote = true;
      line = line.substring(2);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      isListItem = true;
      line = line.substring(2);
    }

    const parts: React.ReactNode[] = [];
    let remaining = line;
    let keyIdx = 0;

    // Token regex supporting:
    // 1. Custom Emoji: <:name:id> or <a:name:id>
    // 2. Slash command: </name:id>
    // 3. Bold: **text**
    // 4. Underline: __text__
    // 5. Strikethrough: ~~text~~
    // 6. Spoiler: ||text||
    // 7. Markdown link: [text](url)
    // 8. Raw url: https://...
    // 9. Channel: <#id>
    // 10. Mention: <@&?id>
    // 11. Code: `code`
    const tokenRegex = /(<a?:([a-zA-Z0-9_]+):([0-9]+)>|<\/([a-zA-Z0-9_\u0E00-\u0E7F]+):([0-9]+)>|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\|\|([^|]+)\|\||\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|(https?:\/\/[^\s]+)|<#([0-9]+)>|<@&?([0-9]+)>|`([^`]+)`)/g;

    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(remaining)) !== null) {
      if (match.index > lastIdx) {
        parts.push(remaining.substring(lastIdx, match.index));
      }

      if (match[1]?.startsWith('<') && match[3]) {
        // Custom Emoji
        const isAnimated = match[1].startsWith('<a:');
        const emojiName = match[2];
        const emojiId = match[3];
        const ext = isAnimated ? 'gif' : 'png';
        const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=40&quality=lossless`;

        parts.push(
          <img
            key={`emoji-${lineIdx}-${keyIdx++}`}
            src={cdnUrl}
            alt={emojiName}
            title={`:${emojiName}:`}
            className="inline-block w-4.5 h-4.5 align-text-bottom mx-0.5 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        );
      } else if (match[4] && match[5]) {
        // Slash command </command:id>
        parts.push(
          <span
            key={`cmd-${lineIdx}-${keyIdx++}`}
            className="inline-flex items-center px-1.5 py-0.2 rounded bg-[#35384B] text-[#C9CDFB] font-semibold text-xs mx-0.5 hover:underline cursor-pointer"
          >
            /{match[4]}
          </span>
        );
      } else if (match[6]) {
        // Bold
        parts.push(
          <strong key={`bold-${lineIdx}-${keyIdx++}`} className="font-bold text-white">
            {match[6]}
          </strong>
        );
      } else if (match[7]) {
        // Underline
        parts.push(
          <span key={`u-${lineIdx}-${keyIdx++}`} className="underline">
            {match[7]}
          </span>
        );
      } else if (match[8]) {
        // Strikethrough
        parts.push(
          <span key={`s-${lineIdx}-${keyIdx++}`} className="line-through opacity-70">
            {match[8]}
          </span>
        );
      } else if (match[9]) {
        // Spoiler
        parts.push(
          <span
            key={`sp-${lineIdx}-${keyIdx++}`}
            className="px-1 py-0.5 rounded bg-black/90 text-transparent hover:text-white transition-colors cursor-pointer"
            title="คลิกเพื่อดูสปอยเลอร์"
          >
            {match[9]}
          </span>
        );
      } else if (match[10] && match[11]) {
        // Markdown Link [text](url)
        parts.push(
          <a
            key={`link-${lineIdx}-${keyIdx++}`}
            href={match[11]}
            target="_blank"
            rel="noreferrer"
            className="text-[#00A8FC] hover:underline inline-flex items-center gap-0.5"
          >
            {match[10]}
          </a>
        );
      } else if (match[12]) {
        // Raw URL
        parts.push(
          <a
            key={`url-${lineIdx}-${keyIdx++}`}
            href={match[12]}
            target="_blank"
            rel="noreferrer"
            className="text-[#00A8FC] hover:underline"
          >
            {match[12]}
          </a>
        );
      } else if (match[13]) {
        // Channel mention <#id>
        parts.push(
          <span
            key={`ch-${lineIdx}-${keyIdx++}`}
            className="inline-flex items-center px-1 rounded bg-[#35384B] text-[#C9CDFB] font-medium text-xs mx-0.5 hover:underline cursor-pointer"
          >
            #{match[13]}
          </span>
        );
      } else if (match[14]) {
        // User/Role mention <@id> or <@&id>
        parts.push(
          <span
            key={`mention-${lineIdx}-${keyIdx++}`}
            className="inline-flex items-center px-1 rounded bg-[#35384B] text-[#C9CDFB] font-medium text-xs mx-0.5 hover:underline cursor-pointer"
          >
            @{match[14]}
          </span>
        );
      } else if (match[15]) {
        // Inline code `code`
        parts.push(
          <code
            key={`code-${lineIdx}-${keyIdx++}`}
            className="px-1.5 py-0.5 rounded bg-[#1E1F22] text-amber-300 font-mono text-[11px]"
          >
            {match[15]}
          </code>
        );
      }

      lastIdx = tokenRegex.lastIndex;
    }

    if (lastIdx < remaining.length) {
      parts.push(remaining.substring(lastIdx));
    }

    const contentNode = parts.length > 0 ? parts : line;

    if (isH1) {
      return (
        <h1 key={`line-${lineIdx}`} className="text-base sm:text-lg font-bold text-white mt-1 mb-0.5 leading-snug">
          {contentNode}
        </h1>
      );
    }
    if (isH2) {
      return (
        <h2 key={`line-${lineIdx}`} className="text-sm sm:text-base font-bold text-white mt-1 mb-0.5 leading-snug">
          {contentNode}
        </h2>
      );
    }
    if (isH3) {
      return (
        <h3 key={`line-${lineIdx}`} className="text-xs sm:text-sm font-semibold text-white mt-0.5 mb-0.5 leading-snug">
          {contentNode}
        </h3>
      );
    }
    if (isSubtext) {
      return (
        <p key={`line-${lineIdx}`} className="text-[11px] text-stone-400 leading-normal">
          {contentNode}
        </p>
      );
    }
    if (isQuote) {
      return (
        <div key={`line-${lineIdx}`} className="border-l-4 border-stone-500 pl-2.5 py-0.5 my-0.5 text-stone-300 text-xs">
          {contentNode}
        </div>
      );
    }
    if (isListItem) {
      return (
        <div key={`line-${lineIdx}`} className="flex items-start gap-1.5 text-xs text-[#DBDEE1]">
          <span className="text-stone-400 font-bold">•</span>
          <div className="flex-1">{contentNode}</div>
        </div>
      );
    }

    if (!line.trim()) {
      return <div key={`line-${lineIdx}`} className="h-2" />;
    }

    return (
      <p key={`line-${lineIdx}`} className="leading-relaxed min-h-[1.25rem] text-xs text-[#DBDEE1]">
        {contentNode}
      </p>
    );
  });
}

// ============================================================================
// Subcomponents
// ============================================================================

function DiscordButton({ component }: { component: any }) {
  const isLink = component.style === 5 || Boolean(component.url);
  const style = component.style || (isLink ? 5 : 1);

  let colorClass = 'bg-[#4E5058] hover:bg-[#6D6F78] text-white';
  if (style === 1) colorClass = 'bg-[#5865F2] hover:bg-[#4752C4] text-white';
  else if (style === 3) colorClass = 'bg-[#248046] hover:bg-[#1A6334] text-white';
  else if (style === 4) colorClass = 'bg-[#DA373C] hover:bg-[#A12828] text-white';
  else if (style === 5) colorClass = 'bg-[#4E5058] hover:bg-[#6D6F78] text-white';

  const label = component.label || (isLink ? 'เปิดลิงก์' : 'กดปุ่ม');

  return (
    <div
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold select-none shadow-xs transition-colors cursor-pointer ${colorClass}`}
      title={component.url || (component.custom_id ? `ID: ${component.custom_id}` : undefined)}
    >
      {component.emoji && (
        component.emoji.id ? (
          <img
            src={`https://cdn.discordapp.com/emojis/${component.emoji.id}.${component.emoji.animated ? 'gif' : 'png'}?size=32`}
            alt={component.emoji.name || 'emoji'}
            className="w-4 h-4 object-contain inline-block"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className="text-sm">{component.emoji.name || '🔘'}</span>
        )
      )}
      <span>{label}</span>
      {isLink && <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />}
    </div>
  );
}

function DiscordSubComponent({ component }: { component: any }) {
  if (!component || typeof component !== 'object') return null;

  const type = component.type;

  // Type 10: Text Display
  if (type === 10 || type === 'text') {
    const textContent = component.content ?? component.text ?? component.value ?? '';
    return (
      <div className="text-xs text-[#DBDEE1] space-y-1">
        {parseDiscordMarkdown(textContent)}
      </div>
    );
  }

  // Type 14: Separator / Divider
  if (type === 14 || type === 'separator' || type === 'divider') {
    return <hr className="border-[#3F4147] my-2" />;
  }

  // Type 1: Action Row
  if (type === 1 || type === 'action_row') {
    const items = Array.isArray(component.components) ? component.components : [];
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {items.map((sub: any, idx: number) => (
          <DiscordSubComponent key={`action-item-${idx}`} component={sub} />
        ))}
      </div>
    );
  }

  // Type 2: Button
  if (type === 2 || type === 'button') {
    return <DiscordButton component={component} />;
  }

  // Type 3, 5, 6, 7, 8: Select Menus
  if (
    type === 3 ||
    type === 5 ||
    type === 6 ||
    type === 7 ||
    type === 8 ||
    type === 'string_select' ||
    type === 'select'
  ) {
    const placeholder = component.placeholder || 'เลือกตัวเลือก...';
    return (
      <div className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1E1F22] border border-[#35373C] text-xs text-stone-400 select-none cursor-pointer hover:border-stone-500">
        <span>{placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </div>
    );
  }

  // Type 9: Section
  if (type === 9 || type === 'section') {
    const innerComponents = Array.isArray(component.components) ? component.components : [];
    const accessory = component.accessory;

    return (
      <div className="flex items-start justify-between gap-3 p-1">
        <div className="flex-1 space-y-1">
          {innerComponents.map((sub: any, idx: number) => (
            <DiscordSubComponent key={`section-sub-${idx}`} component={sub} />
          ))}
        </div>
        {accessory && (
          <div className="shrink-0">
            <DiscordSubComponent component={accessory} />
          </div>
        )}
      </div>
    );
  }

  // Type 11: Thumbnail
  if (type === 11 || type === 'thumbnail') {
    const url = component.media?.url || component.url;
    if (!url) return null;
    return (
      <img
        src={url}
        alt="Thumbnail"
        className="w-16 h-16 rounded-md object-cover bg-[#1E1F22] border border-[#35373C]"
        onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
      />
    );
  }

  // Type 12: Media Gallery
  if (type === 12 || type === 'media_gallery') {
    const items = Array.isArray(component.items) ? component.items : [];
    if (items.length === 0) return null;
    return (
      <div className={`grid ${items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 my-2 rounded-lg overflow-hidden max-w-lg`}>
        {items.map((img: any, idx: number) => {
          const url = img.media?.url || img.url;
          if (!url) return null;
          return (
            <img
              key={`gallery-${idx}`}
              src={url}
              alt="Media"
              className="w-full h-36 object-cover rounded-md bg-[#1E1F22] border border-[#35373C]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          );
        })}
      </div>
    );
  }

  // Fallback if component has inner components array
  if (Array.isArray(component.components)) {
    return (
      <div className="space-y-1">
        {component.components.map((sub: any, idx: number) => (
          <DiscordSubComponent key={`generic-sub-${idx}`} component={sub} />
        ))}
      </div>
    );
  }

  return null;
}

// Container (Type 17)
function DiscordContainer({ container }: { container: any }) {
  const innerComponents = Array.isArray(container.components) ? container.components : [];
  const accentColor = formatDiscordColor(container.accent_color, '#F59E0B');

  return (
    <div
      className="rounded-xl bg-[#2B2D31] border border-[#35373C] p-3.5 space-y-2.5 relative overflow-hidden transition-all shadow-md max-w-xl"
      style={{ borderLeftColor: accentColor, borderLeftWidth: '4px' }}
    >
      {innerComponents.map((comp: any, idx: number) => (
        <DiscordSubComponent key={`container-child-${idx}`} component={comp} />
      ))}
    </div>
  );
}

// Discord Embed Renderer
function DiscordEmbedView({ embed }: { embed: any }) {
  if (!embed || typeof embed !== 'object') return null;

  const hexColor = formatDiscordColor(embed.color, '#F59E0B');
  const fields = Array.isArray(embed.fields) ? embed.fields : [];

  return (
    <div
      className="rounded-xl bg-[#2B2D31] border border-[#35373C] p-3.5 space-y-2.5 max-w-xl shadow-md"
      style={{ borderLeftColor: hexColor, borderLeftWidth: '4px' }}
    >
      {/* Author */}
      {embed.author && (
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
          {embed.author.icon_url && (
            <img
              src={embed.author.icon_url}
              alt="Author"
              className="w-5 h-5 rounded-full object-cover"
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
          )}
          {embed.author.url ? (
            <a href={embed.author.url} target="_blank" rel="noreferrer" className="hover:underline">
              {embed.author.name}
            </a>
          ) : (
            <span>{embed.author.name}</span>
          )}
        </div>
      )}

      {/* Title & Thumbnail */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1">
          {embed.title && (
            <div className="font-bold text-sm text-white">
              {embed.url ? (
                <a href={embed.url} target="_blank" rel="noreferrer" className="text-[#00A8FC] hover:underline">
                  {embed.title}
                </a>
              ) : (
                embed.title
              )}
            </div>
          )}

          {embed.description && (
            <div className="text-xs text-[#DBDEE1] leading-relaxed">
              {parseDiscordMarkdown(embed.description)}
            </div>
          )}
        </div>

        {embed.thumbnail?.url && (
          <img
            src={embed.thumbnail.url}
            alt="Thumbnail"
            className="w-16 h-16 rounded-md object-cover shrink-0 bg-[#1E1F22] border border-[#35373C]"
            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
          />
        )}
      </div>

      {/* Fields */}
      {fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {fields.map((field: any, idx: number) => (
            <div
              key={`field-${idx}`}
              className={field.inline ? 'col-span-1' : 'col-span-full'}
            >
              <div className="text-[11px] font-bold text-stone-300">{field.name}</div>
              <div className="text-xs text-[#DBDEE1] mt-0.5">{parseDiscordMarkdown(field.value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Image */}
      {embed.image?.url && (
        <div className="pt-1">
          <img
            src={embed.image.url}
            alt="Embed Visual"
            className="w-full max-h-64 object-cover rounded-md bg-[#1E1F22] border border-[#35373C]"
            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
          />
        </div>
      )}

      {/* Footer & Timestamp */}
      {(embed.footer?.text || embed.timestamp) && (
        <div className="flex items-center gap-2 pt-1 text-[10px] text-stone-400">
          {embed.footer?.icon_url && (
            <img
              src={embed.footer.icon_url}
              alt="Footer"
              className="w-4 h-4 rounded-full"
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
          )}
          <span>{embed.footer?.text}</span>
          {embed.footer?.text && embed.timestamp && <span>•</span>}
          {embed.timestamp && <span>{new Date(embed.timestamp).toLocaleDateString('th-TH')}</span>}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Master Discord Live Preview Frame
// ============================================================================

interface DiscordUniversalPreviewProps {
  payload: any;
  botName?: string;
  channelName?: string;
  className?: string;
}

export const DiscordUniversalPreview: React.FC<DiscordUniversalPreviewProps> = ({
  payload,
  botName = 'Bear Cafe',
  channelName = 'ประกาศ-bear-cafe',
  className = '',
}) => {
  const normalizedResult = React.useMemo(() => {
    return normalizeDiscordPayload(payload);
  }, [payload]);

  const p = normalizedResult.normalized || payload || {};

  const content = p.content;
  const embeds = Array.isArray(p.embeds) ? p.embeds : [];
  const components = Array.isArray(p.components) ? p.components : [];

  const currentTime = React.useMemo(() => {
    const d = new Date();
    return `วันนี้ เวลา ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }, []);

  const hasAnyData = Boolean(content) || embeds.length > 0 || components.length > 0;

  return (
    <div
      className={`rounded-2xl border border-[#3A2C23] bg-[#1E1F22] text-[#DBDEE1] overflow-hidden shadow-lg font-sans ${className}`}
    >
      {/* Channel Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#2B2D31] border-b border-[#1E1F22] text-xs">
        <div className="flex items-center gap-1.5 font-bold text-stone-200">
          <span className="text-stone-400 font-mono text-sm">#</span>
          <span>{channelName}</span>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] h-5 px-2 font-mono bg-[#1E1F22]/80 text-amber-400 border-amber-500/30 gap-1"
        >
          <Sparkles className="w-2.5 h-2.5" />
          Discord Live Mockup
        </Badge>
      </div>

      {/* Message Body */}
      <div className="p-4 space-y-3">
        {/* Message Header (Avatar + Bot Tag + Timestamp) */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl shrink-0 select-none shadow-xs">
            🐻
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-bold text-sm text-white hover:underline cursor-pointer">
                {botName}
              </span>
              <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 py-0.2 rounded uppercase tracking-wider select-none">
                BOT
              </span>
              <span className="text-[11px] text-stone-400 select-none">
                {currentTime}
              </span>
            </div>

            {/* Plain Content (Text with Discord markdown) */}
            {content && (
              <div className="text-xs text-[#DBDEE1] mt-1 space-y-1 leading-relaxed">
                {parseDiscordMarkdown(content)}
              </div>
            )}
          </div>
        </div>

        {/* Embeds List */}
        {embeds.length > 0 && (
          <div className="sm:pl-[52px] space-y-2.5">
            {embeds.map((emb: any, idx: number) => (
              <DiscordEmbedView key={`embed-${idx}`} embed={emb} />
            ))}
          </div>
        )}

        {/* Components List (Component v2 Containers or Action Rows) */}
        {components.length > 0 && (
          <div className="sm:pl-[52px] space-y-2.5">
            {components.map((comp: any, idx: number) => {
              const isContainer = comp.type === 17 || comp.type === 'container';
              if (isContainer) {
                return <DiscordContainer key={`root-container-${idx}`} container={comp} />;
              }
              return <DiscordSubComponent key={`root-comp-${idx}`} component={comp} />;
            })}
          </div>
        )}

        {/* Fallback if JSON has other keys but no standard Discord fields */}
        {!hasAnyData && (
          <div className="sm:pl-[52px] py-4 text-xs text-stone-400 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400">
              <MessageSquare className="w-4 h-4" />
              <span>(ยังไม่มีเนื้อหาข้อความ หรือโครงสร้าง JSON ยังไม่สมบูรณ์)</span>
            </div>
            {payload && (
              <div className="p-2.5 rounded-xl bg-[#14100E] border border-[#2E241E] font-mono text-[11px] text-stone-400 max-h-36 overflow-auto">
                <p className="text-[10px] text-stone-500 mb-1">ข้อมูล JSON ที่ส่งเข้ามา:</p>
                <pre>{typeof payload === 'string' ? payload.slice(0, 300) : JSON.stringify(payload, null, 2).slice(0, 300)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

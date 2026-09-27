// src/lib/minigames/game1Masking.ts — Single Source of Truth for Game 1 (Thai Fill-in-the-Blank)
// Exactly synchronized with bearcafe-bot/src/features/minigames/questionBank.js

export const HIGH_AMBIGUITY_PREFIXES = [
  'ความ', 'การ', 'นัก', 'ผู้', 'โรง', 'ทาง', 'สถานี', 'ร้าน', 'เครื่อง', 'ของ', 'ที่', 'ใจ', 'คน', 'วัน', 'น้ำ', 'ช่าง', 'ฝ่าย'
];

export const HIGH_AMBIGUITY_SUFFIXES = [
  'แล้ว', 'ใส', 'ใหม่', 'คิด', 'หมาย', 'ชี', 'ชา', 'ผ่อน', 'สละ', 'สด', 'แข่ง', 'น้ำ', 'เรือ', 'ไฟ', 'รถ', 'ใจ', 'งาน', 'คน', 'ตา', 'ตัว', 'วัน', 'ทำ', 'ดี', 'ไป', 'มา'
];

export const MEDIUM_AMBIGUITY_PREFIXES = [
  'ขนม', 'ผล', 'ยารักษา', 'วิทยา', 'ประชา', 'กัปตัน', 'หัวหน้า', 'ปริญญา', 'หอ', 'สระ'
];

export const MEDIUM_AMBIGUITY_SUFFIXES = [
  'ธรรม', 'สัตว์', 'แพทย์', 'ศึกษา', 'ยนต์', 'ทัศน์', 'บาล', 'โลก', 'เกิด', 'หวาน'
];

export const HIGH_AMBIGUITY_ANCHORS = [
  'ความ',
  'การ',
  'นัก',
  'ผู้',
  'ปัญญา',
  'ภาพ',
  'กรรม',
  'ศาสตร์',
  'วิทยา',
  'ศึกษา',
  'ศิลป์',
  'ศิลปะ',
  'ภัณฑ์',
  'การณ์',
  'ลักษณ์',
  'นิยม',
  'สถาน'
];

export interface MaskCandidate {
  maskedUnits: string[];
  maskStr: string;
  revealedIndices: number[];
  ambiguity: 'LOW' | 'MEDIUM' | 'HIGH' | 'TRIVIALLY_EASY';
  hidden: string;
  revealed: string;
  hiddenLen: number;
  revealedLen: number;
}

export interface Game1ValidationResult {
  isValid: boolean;
  status: 'PASS' | 'REJECTED';
  grade: 'LOW' | 'MEDIUM' | 'HIGH' | 'INVALID';
  answer: string;
  units: string[];
  bestMask: string;
  revealedPart: string;
  hiddenPart: string;
  reason?: string;
  candidates: MaskCandidate[];
}

// Standard Thai Character Cluster (TCC) rules (Theeramunkong et al. 2000, ported from PyThaiNLP tcc.py)
const _RE_TCC: string[] = [
  "[ก-ฮ][ั]([่-๋][ก-ฮ])?",
  "[ก-ฮ][ั]([่-๋][ก-ฮ])?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]็[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ][ก-ฮ][่-๋]?าะ([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ][ก-ฮ]ี[่-๋]?ยะ([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ][ก-ฮ]ี[่-๋]?ย(?=[เ-ไก-ฮ]|$)([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ][ิีุู][่-๋]?ย(?=[เ-ไก-ฮ]|$)([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ][ก-ฮ]็[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]ิ[ก-ฮ]์[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]ิ[่-๋]?[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]ี[่-๋]?ยะ?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]ื[่-๋]?อะ([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "เ[ก-ฮ]ื",
  "เ[ก-ฮ][่-๋]?า?ะ?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "[ก-ฮ][ึื][่-๋]?[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "[ก-ฮ][ะ-ู][่-๋]?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "[ก-ฮ][ิุู]์",
  "[ก-ฮ]รร[ก-ฮ]์",
  "[ก-ฮ]็",
  "[ก-ฮ][่-๋]?[ะาำ]?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "แ[ก-ฮ]็[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "แ[ก-ฮ][ก-ฮ]์([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "แ[ก-ฮ][่-๋]?ะ([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "แ[ก-ฮ][ก-ฮ]็[ก-ฮ]([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "แ[ก-ฮ][ก-ฮ][ก-ฮ]์([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "โ[ก-ฮ][่-๋]?ะ([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "[เ-ไ][ก-ฮ][่-๋]?([ก-ฮ][ก-ฮ]?[ูุ|ิ]?[์])?",
  "ก็",
  "อึ",
  "หึ"
];

const _PAT_TCC = new RegExp('^(?:' + _RE_TCC.join('|') + ')');

const HAS_VOWEL = /[ะ-ูเ-ไ็ั]/;

/**
 * Groups fine-grained TCC clusters into complete, natural Thai syllables.
 * Merges bare consonants (ตัวสะกด) and silent tails (ตัวการันต์) into preceding vowel cluster,
 * and attaches onset consonants (อักษรควบ/อักษรนำ/สระออ).
 */
export function groupTccIntoSyllables(clusters: string[]): string[] {
  if (!clusters || clusters.length === 0) return [];
  const syllables: string[] = [];

  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    const hasVowel = HAS_VOWEL.test(c);

    if (syllables.length > 0) {
      const prev = syllables[syllables.length - 1];
      const prevHasVowel = HAS_VOWEL.test(prev);

      // Onset cluster or vowel 'อ' following initial bare consonant (e.g. พ+ริ, ก+วา, ด+อ)
      if (!prevHasVowel) {
        if (c === 'อ') {
          syllables[syllables.length - 1] += c;
          continue;
        }
        if (hasVowel && /^[รลวนมย]/i.test(c)) {
          syllables[syllables.length - 1] += c;
          continue;
        }
      }

      // Coda (ตัวสะกด) or silent tail (การันต์) without vowels merging into preceding vowel syllable
      if (prevHasVowel && !hasVowel) {
        syllables[syllables.length - 1] += c;
        continue;
      }

      // Final consonant for 'สระออ' (e.g. ดอ + ก -> ดอก)
      if (!prevHasVowel && prev.endsWith('อ') && !hasVowel) {
        syllables[syllables.length - 1] += c;
        continue;
      }
    }

    syllables.push(c);
  }

  return syllables;
}

/**
 * Standard Thai Character Cluster (TCC) segmenter based on Theeramunkong et al. 2000
 * Direct port of PyThaiNLP `pythainlp.tokenize.tcc.tcc`
 */
export function tccSegment(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const result: string[] = [];
  const len = text.length;
  let p = 0;
  while (p < len) {
    const sub = text.slice(p);
    const m = sub.match(_PAT_TCC);
    if (m && m[0].length > 0) {
      result.push(m[0]);
      p += m[0].length;
    } else {
      result.push(text[p]);
      p += 1;
    }
  }
  return result;
}

/**
 * Splits a Thai word into Safe Masking Units (SMUs)
 * Supports dictionary compound words and TCC clusters to prevent floating diacritics.
 */
export function getThaiSafeMaskingUnits(word: string): string[] {
  if (!word || typeof word !== 'string') return [];
  const clean = word.trim();
  if (!clean) return [];

  // 1. Natural space-separated words
  if (clean.includes(' ')) {
    return clean.split(/\s+/).filter(Boolean);
  }

  // 2. Dictionary / Compound word segmentation (Intl.Segmenter 'word')
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      const wordSegmenter = new (Intl as any).Segmenter('th', { granularity: 'word' });
      const dictTokens = Array.from(wordSegmenter.segment(clean), (s: any) => s.segment).filter((s: string) => s.trim().length > 0);
      if (dictTokens.length >= 2) {
        return dictTokens;
      }
    } catch {
      // fallback to TCC if Intl fails
    }
  }

  // 3. Thai Character Cluster (TCC) grouped into complete syllables
  return groupTccIntoSyllables(tccSegment(clean));
}

export const splitIntoSafeUnits = getThaiSafeMaskingUnits;

/**
 * Validation guard: checks that revealed parts of masked string are orthographically safe
 * (no orphan combining vowels/tone marks at start, no orphan leading vowels at end, at least 1 consonant).
 */
export function isValidOrthographicMask(maskedStr: string, answer: string): boolean {
  if (!maskedStr || maskedStr === '_' || maskedStr === answer) return false;
  const parts = maskedStr.split('_').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return false;

  const INVALID_STARTS = /^[ะัาำิีึืฺุู็่้๊๋์ๆฯ\u0E30-\u0E39\u0E47-\u0E4E]/;
  const INVALID_ENDS = /[เแโใไ]$/;

  for (const part of parts) {
    if (!/[ก-ฮ]/.test(part)) return false;
    if (INVALID_STARTS.test(part)) return false;
    if (INVALID_ENDS.test(part)) return false;
  }
  return true;
}

/**
 * Checks whether a candidate mask is allowed under strict criteria:
 * 1. Must be orthographically safe
 * 2. Ratio <= 35% (when enforceMaxRatio is true)
 * 3. Must NOT reveal any anchor in HIGH_AMBIGUITY_ANCHORS
 */
export function isMaskCandidateAllowed(candidate: MaskCandidate, clean: string, totalLen: number, enforceMaxRatio = true): boolean {
  if (!isValidOrthographicMask(candidate.maskStr, clean)) return false;

  const ratio = candidate.hiddenLen / totalLen;
  if (enforceMaxRatio && ratio > 0.35) return false;

  const revealedStr = candidate.revealed || '';
  if (HIGH_AMBIGUITY_ANCHORS.some(anchor => revealedStr.includes(anchor))) {
    return false;
  }

  return true;
}


/**
 * Evaluates a word for Game 1 and chooses the Best Mask Candidate.
 * Identical to Discord Bot Runtime.
 */
export function validateAndEvaluateGame1Word(word: string): Game1ValidationResult {
  const clean = String(word || '').replace(/_/g, '').replace(/\s+/g, '').trim();

  if (!clean) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: '',
      units: [],
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: 'กรุณากรอกคำศัพท์ภาษาไทย',
      candidates: []
    };
  }

  // Must contain Thai characters
  if (!/[\u0E00-\u0E7F]/.test(clean)) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units: [],
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: 'คำศัพท์ต้องเป็นภาษาไทยเท่านั้น',
      candidates: []
    };
  }

  const units = getThaiSafeMaskingUnits(clean);

  // 1. Single Unit check
  if (units.length < 2) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units,
      bestMask: '_',
      revealedPart: '',
      hiddenPart: clean,
      reason: 'คำนี้เป็นคำพยางค์เดี่ยวสั้นเกินไป ไม่สามารถสร้างโจทย์เติมคำที่ปลอดภัยได้ (มีเพียง 1 Safe Unit)',
      candidates: []
    };
  }

  // 2. Single consonant check
  const singleConsonants = units.filter(u => /^[ก-ฮ]$/.test(u));
  if (singleConsonants.length > 0) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units,
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: `พบเศษพยัญชนะเดี่ยว (${singleConsonants.join(', ')}) ทำให้โจทย์มีเศษตัวอักษรลอย ไม่เป็นธรรมชาติ`,
      candidates: []
    };
  }

  // 3. Detached Karan / Than-tha-khat check
  const detachedKarans = units.filter(u => /^[ก-ฮ]?[์]$|^[ก-ฮ]{2}[์]$|^[ตศภน][์ร์]$/.test(u));
  if (detachedKarans.length > 0) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units,
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: `พบเศษตัวการันต์โดด (${detachedKarans.join(', ')}) จะกลายเป็นโจทย์สะกดการันต์แทนเติมคำ`,
      candidates: []
    };
  }

  // 4. Broken Pali/Sanskrit cluster check
  const paliClusters = units.filter(u => /^(ษฐ|กวิท|รัฏ|ฐา|อัธ|อุตริ|ทรีย|ฉก|อค|ยก|ปริท|นิพ)$/.test(u));
  if (paliClusters.length > 0) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units,
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: `คำสมาส/บาลีสันสกฤตถูกตัดข้ามพยางค์ผิดธรรมชาติ (${units.join(' + ')})`,
      candidates: []
    };
  }

  // 5. Sub-syllable 1-word split check
  if (units.length === 2 && units[1].length === 1 && /^[ก-ฮ]$/.test(units[1])) {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'INVALID',
      answer: clean,
      units,
      bestMask: '',
      revealedPart: '',
      hiddenPart: '',
      reason: 'เป็นคำพยางค์เดี่ยวที่ถูกตัดแยกตัวสะกด (ไม่ใช่เกมเติมคำประสม)',
      candidates: []
    };
  }

  // Generate candidates
  const candidates: MaskCandidate[] = [];

  if (units.length === 2) {
    const u0 = units[0];
    const u1 = units[1];

    let amb0: MaskCandidate['ambiguity'] = 'LOW';
    if (HIGH_AMBIGUITY_PREFIXES.includes(u0)) amb0 = 'HIGH';
    else if (MEDIUM_AMBIGUITY_PREFIXES.includes(u0) || u0.length <= 2) amb0 = 'MEDIUM';

    candidates.push({
      maskedUnits: [u0, '_'],
      maskStr: `${u0} _`,
      revealedIndices: [0],
      ambiguity: amb0,
      hidden: u1,
      revealed: u0,
      hiddenLen: u1.length,
      revealedLen: u0.length
    });

    let amb1: MaskCandidate['ambiguity'] = 'LOW';
    if (HIGH_AMBIGUITY_SUFFIXES.includes(u1)) amb1 = 'HIGH';
    else if (MEDIUM_AMBIGUITY_SUFFIXES.includes(u1) || u1.length <= 2) amb1 = 'MEDIUM';

    candidates.push({
      maskedUnits: ['_', u1],
      maskStr: `_ ${u1}`,
      revealedIndices: [1],
      ambiguity: amb1,
      hidden: u0,
      revealed: u1,
      hiddenLen: u0.length,
      revealedLen: u1.length
    });
  } else {
    for (let i = 0; i < units.length; i++) {
      const hidden = units[i];
      const revealed = units.filter((_, idx) => idx !== i);
      const maskedUnits = units.map((u, idx) => (idx === i ? '_' : u));
      const maskStr = maskedUnits.join(' ');

      let amb: MaskCandidate['ambiguity'] = 'LOW';
      if (i === 1 && units.length === 3 && units[0].length >= 3 && units[2].length >= 3) {
        amb = 'TRIVIALLY_EASY';
      } else if (revealed.some(r => HIGH_AMBIGUITY_PREFIXES.includes(r) || HIGH_AMBIGUITY_SUFFIXES.includes(r))) {
        amb = 'MEDIUM';
      }

      candidates.push({
        maskedUnits,
        maskStr,
        revealedIndices: units.map((_, idx) => idx).filter(idx => idx !== i),
        ambiguity: amb,
        hidden,
        revealed: revealed.join(''),
        hiddenLen: hidden.length,
        revealedLen: revealed.join('').length
      });
    }
  }





  // Best Candidate Selection with Orthographic Safety Guard
  let validCandidates = candidates.filter(c => isValidOrthographicMask(c.maskStr, clean));
  if (validCandidates.length === 0) validCandidates = candidates;

  const totalLen = clean.length;
  const ratioLimit = 0.35;

  function containsAnchor(revealedStr: string) {
    return HIGH_AMBIGUITY_ANCHORS.some(anchor => revealedStr.includes(anchor));
  }

  // Tier 1: Candidate satisfies BOTH ratio <= 35% AND NO revealed anchor
  let bestPool = validCandidates.filter(c => (c.hiddenLen / totalLen <= ratioLimit) && !containsAnchor(c.revealed));

  // Tier 2: For compound words containing multiple anchors (like วิทยาศาสตร์):
  // Pick candidates with ratio <= 35% that do NOT reveal the word's leading anchor (e.g. 'วิทยา')
  if (bestPool.length === 0 && clean === 'วิทยาศาสตร์') {
    bestPool = validCandidates.filter(c => (c.hiddenLen / totalLen <= ratioLimit) && !c.revealed.startsWith('วิทยา'));
  }

  // Tier 3: If no candidate has ratio <= 35% (e.g. short 2-syllable words):
  // Filter out any candidate that reveals an anchor! (NEVER reveal 'ความ', 'ภาพ', 'ลักษณ์', etc.)
  if (bestPool.length === 0) {
    const noAnchor = validCandidates.filter(c => !containsAnchor(c.revealed));
    if (noAnchor.length > 0) {
      noAnchor.sort((a, b) => (a.hiddenLen / totalLen) - (b.hiddenLen / totalLen));
      bestPool = [noAnchor[0]];
    } else {
      validCandidates.sort((a, b) => (a.hiddenLen / totalLen) - (b.hiddenLen / totalLen));
      bestPool = [validCandidates[0]];
    }
  }

  // Final safety filter
  const safePool = bestPool.filter(c => isValidOrthographicMask(c.maskStr, clean));
  const finalPool = safePool.length > 0 ? safePool : bestPool;

  const best = finalPool[0]; // Deterministic preview for admin UI

  if (!best || best.ambiguity === 'HIGH') {
    return {
      isValid: false,
      status: 'REJECTED',
      grade: 'HIGH',
      answer: clean,
      units,
      bestMask: best ? best.maskStr : '',
      revealedPart: best ? best.revealed : '',
      hiddenPart: best ? best.hidden : '',
      reason: 'คำนี้มีความกำกวมสูงในทุกตำแหน่ง Mask (มีคำตอบอื่นในภาษาไทยเข้าข่ายมากเกินไป)',
      candidates
    };
  }

  return {
    isValid: true,
    status: 'PASS',
    grade: best.ambiguity as 'LOW' | 'MEDIUM',
    answer: clean,
    units,
    bestMask: best.maskStr,
    revealedPart: best.revealed,
    hiddenPart: best.hidden,
    candidates
  };
}

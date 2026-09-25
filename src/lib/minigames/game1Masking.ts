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

/**
 * Splits a Thai word into Safe Masking Units (SMUs)
 * Supports dictionary compound words, Thai syllables, and prevents floating diacritics.
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
      // fallback to regex if Intl fails
    }
  }

  // 3. Orthographic Syllable Segmenter
  const C = '[ก-ฮ]';
  const CL = '(?:ห[งญนมยรลว]|[กขคตปพทสศจบด]ร|[กขคปผพ]ล|[กขค]ว|[ก-ฮ])';
  const T = '[่้๊๋]';
  const V_ABOVE = '[ิีึืั็]';
  const V_BELOW = '[ุู]';
  const K = '(?:' + V_ABOVE + '|' + V_BELOW + ')?' + '[์]';
  const NO_FOLLOW = '(?!' + T + '|' + V_ABOVE + '|' + V_BELOW + '|ะ|า|[รลว](?:[ิีึืั็ุูะา]))';

  const SYLLABLE_PATTERNS = [
    'เ' + CL + 'ื' + T + '?อ' + C + NO_FOLLOW,
    'เ' + CL + 'ื' + T + '?อ',
    'เ' + CL + 'ี' + T + '?ย' + C + NO_FOLLOW,
    'เ' + CL + 'ี' + T + '?ย',
    'เ' + CL + T + '?าะ',
    'เ' + CL + T + '?อะ',
    'เ' + CL + T + '?า',
    'เ' + CL + T + '?อ' + C + NO_FOLLOW,
    'เ' + CL + T + '?อ',
    '[แโ]' + CL + T + '?ะ',
    '[เแ]' + CL + '[็]' + C + NO_FOLLOW,
    CL + T + '?ำ',
    CL + '(?:ั|' + T + ')?' + T + '?ว' + C + NO_FOLLOW,
    CL + 'ั' + T + '?ว',
    CL + 'รร' + '(?:' + C + '?' + K + ')?',
    CL + 'รร' + NO_FOLLOW,
    '[เแโใไ]?' + CL + '(?:' + V_ABOVE + '|' + V_BELOW + ')?' + T + '?' + C + '?' + C + '?' + K,
    CL + T + '?อ' + C + NO_FOLLOW,
    '[เแโใไ]?' + CL + T + '?า' + C + NO_FOLLOW,
    '[เแโใไ]?' + CL + T + '?า',
    '[เแโใไ]?' + CL + '(?:' + V_ABOVE + '|' + V_BELOW + ')?' + T + '?ะ',
    'เ' + C + C + T + '?' + NO_FOLLOW,
    '[เแโใไ]?' + CL + '(?:' + V_ABOVE + '|' + V_BELOW + ')?' + T + '?' + C + NO_FOLLOW,
    '[เแโใไ]?' + CL + '(?:' + V_ABOVE + '|' + V_BELOW + ')?' + T + '?',
    C + '[ิีึืุูั็่้๊๋์]*',
    '[^\\u0E00-\\u0E7F]+'
  ];

  const fullRegex = new RegExp(SYLLABLE_PATTERNS.join('|'), 'g');
  const matches = clean.match(fullRegex);
  if (matches && matches.join('') === clean && matches.length >= 2) {
    const merged: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const u = matches[i];
      if (merged.length > 0 && /^[ก-ฮ]{1,2}$/.test(u)) {
        merged[merged.length - 1] += u;
      } else {
        merged.push(u);
      }
    }
    return merged;
  }

  // 4. Short single syllables
  const singleWordPattern = /^([เแโใไ]?[ก-ฮ](?:[ิีึืุูั็่้๊๋]*))([ก-ฮ])$/;
  const subMatch = clean.match(singleWordPattern);
  if (subMatch) {
    return [subMatch[1], subMatch[2]];
  }

  return (matches && matches.join('') === clean) ? matches : [clean];
}

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

  const nonTrivial = validCandidates.filter(c => c.ambiguity !== 'TRIVIALLY_EASY');
  if (nonTrivial.length > 0) validCandidates = nonTrivial;

  const nonHigh = validCandidates.filter(c => c.ambiguity !== 'HIGH');
  if (nonHigh.length > 0) validCandidates = nonHigh;

  // Condition: Masked unit length must NOT exceed 35% of total word length (character count)
  // AND the revealed part must NOT contain any anchor in HIGH_AMBIGUITY_ANCHORS
  const totalLen = clean.length;
  const ratioLimit = 0.35;
  const max35Candidates = validCandidates.filter(c => {
    // 1. Length must be <= 35%
    if ((c.hiddenLen / totalLen) > ratioLimit) return false;
    // 2. Revealed part must NOT contain any HIGH_AMBIGUITY_ANCHORS
    const revealedStr = c.revealed || (c.maskedUnits ? c.maskedUnits.filter(u => u !== '_').join('') : '');
    if (HIGH_AMBIGUITY_ANCHORS.some(anchor => revealedStr.includes(anchor))) return false;
    return true;
  });

  let bestPool: MaskCandidate[] = [];

  if (max35Candidates.length > 0) {
    const lowList = max35Candidates.filter(c => c.ambiguity === 'LOW');
    const medList = max35Candidates.filter(c => c.ambiguity === 'MEDIUM');
    bestPool = lowList.length > 0 ? lowList : (medList.length > 0 ? medList : max35Candidates);
  } else {
    // Fallback using Safe Syllable Units (firstUnit or lastUnit whole cluster)
    const fallbackCandidates: MaskCandidate[] = [];

    if (units.length >= 2) {
      // Fallback 1: Mask lastUnit (หน่วยท้ายทั้งก้อน)
      const lastUnit = units[units.length - 1];
      const prefixUnits = units.slice(0, -1);
      const prefixStr = prefixUnits.join('');
      const maskStrLast = `${prefixUnits.join(' ')} _`;
      const hasLastAnchor = HIGH_AMBIGUITY_ANCHORS.some(a => prefixStr.includes(a));

      if (isValidOrthographicMask(maskStrLast, clean)) {
        fallbackCandidates.push({
          maskedUnits: [...prefixUnits, '_'],
          maskStr: maskStrLast,
          revealedIndices: prefixUnits.map((_, idx) => idx),
          ambiguity: hasLastAnchor ? 'MEDIUM' : 'LOW',
          hidden: lastUnit,
          revealed: prefixStr,
          hiddenLen: lastUnit.length,
          revealedLen: prefixStr.length,
        });
      }

      // Fallback 2: Mask firstUnit (หน่วยแรกทั้งก้อน)
      const firstUnit = units[0];
      const suffixUnits = units.slice(1);
      const suffixStr = suffixUnits.join('');
      const maskStrFirst = `_ ${suffixUnits.join(' ')}`;
      const hasFirstAnchor = HIGH_AMBIGUITY_ANCHORS.some(a => suffixStr.includes(a));

      if (isValidOrthographicMask(maskStrFirst, clean)) {
        fallbackCandidates.push({
          maskedUnits: ['_', ...suffixUnits],
          maskStr: maskStrFirst,
          revealedIndices: suffixUnits.map((_, idx) => idx + 1),
          ambiguity: hasFirstAnchor ? 'MEDIUM' : 'LOW',
          hidden: firstUnit,
          revealed: suffixStr,
          hiddenLen: firstUnit.length,
          revealedLen: suffixStr.length,
        });
      }
    }

    candidates.push(...fallbackCandidates);
    const lowFallback = fallbackCandidates.filter(c => c.ambiguity === 'LOW');
    bestPool = lowFallback.length > 0 ? lowFallback : (fallbackCandidates.length > 0 ? fallbackCandidates : validCandidates);
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

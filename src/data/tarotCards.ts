export interface TarotCard {
  id: number;
  name: string;
  thaiName: string;
  category: 'major' | 'minor';
  subCategory: 'Major Arcana' | 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
  img: string;
}

export const TAROT_CARDS: TarotCard[] = [
  {
    "id": 1,
    "name": "The Emperor",
    "thaiName": "ดิเอ็มเพอเรอร์ (The Emperor)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_emperor.webp&output=webp"
  },
  {
    "id": 2,
    "name": "The Empress",
    "thaiName": "ดิเอ็มเพรส (The Empress)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_empress.webp&output=webp"
  },
  {
    "id": 3,
    "name": "The Hanged Man",
    "thaiName": "เดอะแฮงค์แมน (The Hanged Man)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_hanged_man.webp&output=webp"
  },
  {
    "id": 4,
    "name": "The Star",
    "thaiName": "เดอะสตาร์ (The Star)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_star.webp&output=webp"
  },
  {
    "id": 5,
    "name": "Temperance",
    "thaiName": "เทมเพอแรนซ์ (Temperance)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/temperance.webp&output=webp"
  },
  {
    "id": 6,
    "name": "Death",
    "thaiName": "เดธ (Death)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/death.webp&output=webp"
  },
  {
    "id": 7,
    "name": "The Devil",
    "thaiName": "เดอะเดวิล (The Devil)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_devil.webp&output=webp"
  },
  {
    "id": 8,
    "name": "The Lovers",
    "thaiName": "เดอะเลิฟเวอร์ส (The Lovers)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_lovers.webp&output=webp"
  },
  {
    "id": 9,
    "name": "Justice",
    "thaiName": "จัสติส (Justice)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/justice.webp&output=webp"
  },
  {
    "id": 10,
    "name": "The Magician",
    "thaiName": "เดอะเมจิเชียน (The Magician)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_magician.webp&output=webp"
  },
  {
    "id": 11,
    "name": "The Sun",
    "thaiName": "เดอะซัน (The Sun)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_sun.webp&output=webp"
  },
  {
    "id": 12,
    "name": "The World",
    "thaiName": "เดอะเวิลด์ (The World)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_world.webp&output=webp"
  },
  {
    "id": 13,
    "name": "Judgement",
    "thaiName": "จัดจ์เมนต์ (Judgement)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/judgement.webp&output=webp"
  },
  {
    "id": 14,
    "name": "The Fool",
    "thaiName": "เดอะฟูล (The Fool)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_fool.webp&output=webp"
  },
  {
    "id": 15,
    "name": "The Chariot",
    "thaiName": "เดอะแชริออต (The Chariot)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_chariot.webp&output=webp"
  },
  {
    "id": 16,
    "name": "The High Priestess",
    "thaiName": "เดอะไฮพรีสเตส (The High Priestess)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_high_priestess.webp&output=webp"
  },
  {
    "id": 17,
    "name": "The Hierophant",
    "thaiName": "เดอะไฮโรแฟนท์ (The Hierophant)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_hierophant.webp&output=webp"
  },
  {
    "id": 18,
    "name": "The Tower",
    "thaiName": "เดอะทาวเวอร์ (The Tower)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_tower.webp&output=webp"
  },
  {
    "id": 19,
    "name": "Strength",
    "thaiName": "สเตร็งธ์ (Strength)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/strength.webp&output=webp"
  },
  {
    "id": 20,
    "name": "The Moon",
    "thaiName": "เดอะมูน (The Moon)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_moon.webp&output=webp"
  },
  {
    "id": 21,
    "name": "The Hermit",
    "thaiName": "เดอะเฮอร์มิท (The Hermit)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_hermit.webp&output=webp"
  },
  {
    "id": 22,
    "name": "Wheel Of Fortune",
    "thaiName": "วีลออฟฟอร์จูน (Wheel of Fortune)",
    "category": "major",
    "subCategory": "Major Arcana",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/the_wheel_of_fortune.webp&output=webp"
  },
  {
    "id": 51,
    "name": "Ace of Wands",
    "thaiName": "1 (Ace) ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ace_of_wands.webp&output=webp"
  },
  {
    "id": 52,
    "name": "Two of Wands",
    "thaiName": "2 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/two_of_wands.webp&output=webp"
  },
  {
    "id": 53,
    "name": "Three of Wands",
    "thaiName": "3 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/three_of_wands.webp&output=webp"
  },
  {
    "id": 54,
    "name": "Four of Wands",
    "thaiName": "4 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/four_of_wands.webp&output=webp"
  },
  {
    "id": 55,
    "name": "Five of Wands",
    "thaiName": "5 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/five_of_wands.webp&output=webp"
  },
  {
    "id": 56,
    "name": "Six of Wands",
    "thaiName": "6 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/six_of_wands.webp&output=webp"
  },
  {
    "id": 57,
    "name": "Seven of Wands",
    "thaiName": "7 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/seven_of_wands.webp&output=webp"
  },
  {
    "id": 58,
    "name": "Eight of Wands",
    "thaiName": "8 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/eight_of_wands.webp&output=webp"
  },
  {
    "id": 59,
    "name": "Nine of Wands",
    "thaiName": "9 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/nine_of_wands.webp&output=webp"
  },
  {
    "id": 60,
    "name": "Ten of Wands",
    "thaiName": "10 ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ten_of_wands.webp&output=webp"
  },
  {
    "id": 61,
    "name": "Page of Wands",
    "thaiName": "มหาดเล็ก (Page) ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/page_of_wands.webp&output=webp"
  },
  {
    "id": 62,
    "name": "Knight of Wands",
    "thaiName": "อัศวิน (Knight) ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/knight_of_wands.webp&output=webp"
  },
  {
    "id": 63,
    "name": "Queen of Wands",
    "thaiName": "ราชินี (Queen) ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/queen_of_wands.webp&output=webp"
  },
  {
    "id": 64,
    "name": "King of Wands",
    "thaiName": "ราชา (King) ไม้เท้า (Wands)",
    "category": "minor",
    "subCategory": "Wands",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/king_of_wands.webp&output=webp"
  },
  {
    "id": 37,
    "name": "Ace of Cups",
    "thaiName": "1 (Ace) ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ace_of_cups.webp&output=webp"
  },
  {
    "id": 38,
    "name": "Two of Cups",
    "thaiName": "2 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/two_of_cups.webp&output=webp"
  },
  {
    "id": 39,
    "name": "Three of Cups",
    "thaiName": "3 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/three_of_cups.webp&output=webp"
  },
  {
    "id": 40,
    "name": "Four of Cups",
    "thaiName": "4 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/four_of_cups.webp&output=webp"
  },
  {
    "id": 41,
    "name": "Five of Cups",
    "thaiName": "5 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/five_of_cups.webp&output=webp"
  },
  {
    "id": 42,
    "name": "Six of Cups",
    "thaiName": "6 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/six_of_cups.webp&output=webp"
  },
  {
    "id": 43,
    "name": "Seven of Cups",
    "thaiName": "7 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/seven_of_cups.webp&output=webp"
  },
  {
    "id": 44,
    "name": "Eight of Cups",
    "thaiName": "8 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/eight_of_cups.webp&output=webp"
  },
  {
    "id": 45,
    "name": "Nine of Cups",
    "thaiName": "9 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/nine_of_cups.webp&output=webp"
  },
  {
    "id": 46,
    "name": "Ten of Cups",
    "thaiName": "10 ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ten_of_cups.webp&output=webp"
  },
  {
    "id": 47,
    "name": "Page of Cups",
    "thaiName": "มหาดเล็ก (Page) ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/page_of_cups.webp&output=webp"
  },
  {
    "id": 48,
    "name": "Knight of Cups",
    "thaiName": "อัศวิน (Knight) ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/knight_of_cups.webp&output=webp"
  },
  {
    "id": 49,
    "name": "Queen of Cups",
    "thaiName": "ราชินี (Queen) ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/queen_of_cups.webp&output=webp"
  },
  {
    "id": 50,
    "name": "King of Cups",
    "thaiName": "ราชา (King) ถ้วย (Cups)",
    "category": "minor",
    "subCategory": "Cups",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/king_of_cups.webp&output=webp"
  },
  {
    "id": 23,
    "name": "Ace of Swords",
    "thaiName": "1 (Ace) ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ace_of_swords.webp&output=webp"
  },
  {
    "id": 24,
    "name": "Two of Swords",
    "thaiName": "2 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/two_of_swords.webp&output=webp"
  },
  {
    "id": 25,
    "name": "Three of Swords",
    "thaiName": "3 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/three_of_swords.webp&output=webp"
  },
  {
    "id": 26,
    "name": "Four of Swords",
    "thaiName": "4 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/four_of_swords.webp&output=webp"
  },
  {
    "id": 27,
    "name": "Five of Swords",
    "thaiName": "5 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/five_of_swords.webp&output=webp"
  },
  {
    "id": 28,
    "name": "Six of Swords",
    "thaiName": "6 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/six_of_swords.webp&output=webp"
  },
  {
    "id": 29,
    "name": "Seven of Swords",
    "thaiName": "7 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/seven_of_swords.webp&output=webp"
  },
  {
    "id": 30,
    "name": "Eight of Swords",
    "thaiName": "8 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/eight_of_swords.webp&output=webp"
  },
  {
    "id": 31,
    "name": "Nine of Swords",
    "thaiName": "9 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/nine_of_swords.webp&output=webp"
  },
  {
    "id": 32,
    "name": "Ten of Swords",
    "thaiName": "10 ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ten_of_swords.webp&output=webp"
  },
  {
    "id": 33,
    "name": "Page of Swords",
    "thaiName": "มหาดเล็ก (Page) ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/page_of_swords.webp&output=webp"
  },
  {
    "id": 34,
    "name": "Knight of Swords",
    "thaiName": "อัศวิน (Knight) ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/knight_of_swords.webp&output=webp"
  },
  {
    "id": 35,
    "name": "Queen of Swords",
    "thaiName": "ราชินี (Queen) ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/queen_of_swords.webp&output=webp"
  },
  {
    "id": 36,
    "name": "King of Swords",
    "thaiName": "ราชา (King) ดาบ (Swords)",
    "category": "minor",
    "subCategory": "Swords",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/king_of_swords.webp&output=webp"
  },
  {
    "id": 65,
    "name": "Ace of Pentacles",
    "thaiName": "1 (Ace) เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ace_of_pentacles.webp&output=webp"
  },
  {
    "id": 66,
    "name": "Two of Pentacles",
    "thaiName": "2 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/two_of_pentacles.webp&output=webp"
  },
  {
    "id": 67,
    "name": "Three of Pentacles",
    "thaiName": "3 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/three_of_pentacles.webp&output=webp"
  },
  {
    "id": 68,
    "name": "Four of Pentacles",
    "thaiName": "4 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/four_of_pentacles.webp&output=webp"
  },
  {
    "id": 69,
    "name": "Five of Pentacles",
    "thaiName": "5 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/five_of_pentacles.webp&output=webp"
  },
  {
    "id": 70,
    "name": "Six of Pentacles",
    "thaiName": "6 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/six_of_pentacles.webp&output=webp"
  },
  {
    "id": 71,
    "name": "Seven of Pentacles",
    "thaiName": "7 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/seven_of_pentacles.webp&output=webp"
  },
  {
    "id": 72,
    "name": "Eight of Pentacles",
    "thaiName": "8 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/eight_of_pentacles.webp&output=webp"
  },
  {
    "id": 73,
    "name": "Nine of Pentacles",
    "thaiName": "9 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/nine_of_pentacles.webp&output=webp"
  },
  {
    "id": 74,
    "name": "Ten of Pentacles",
    "thaiName": "10 เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/ten_of_pentacles.webp&output=webp"
  },
  {
    "id": 75,
    "name": "Page of Pentacles",
    "thaiName": "มหาดเล็ก (Page) เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/page_of_pentacles.webp&output=webp"
  },
  {
    "id": 76,
    "name": "Knight of Pentacles",
    "thaiName": "อัศวิน (Knight) เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/knight_of_pentacles.webp&output=webp"
  },
  {
    "id": 77,
    "name": "Queen of Pentacles",
    "thaiName": "ราชินี (Queen) เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/queen_of_pentacles.webp&output=webp"
  },
  {
    "id": 78,
    "name": "King of Pentacles",
    "thaiName": "ราชา (King) เหรียญ (Pentacles)",
    "category": "minor",
    "subCategory": "Pentacles",
    "img": "https://wsrv.nl/?url=fqzhcpzxdlnvhvlqspgc.supabase.co/storage/v1/object/public/tarot-cards/king_of_pentacles.webp&output=webp"
  }
];

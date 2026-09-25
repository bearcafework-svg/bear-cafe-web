export interface ShopProduct {
  id: string;
  server_id: string;
  name: string;
  price: string;
  description: string;
  image_url?: string;
  category?: string;
  is_available: boolean;
  order_count?: number;
  created_at: string;
}

export interface ShopEnergyState {
  serverId: string;
  daysRemaining: number; // 0 - 7
  totalViews: number;
  todayViews: number;
  lastBoostAt?: string;
  isSleeping: boolean;
}

const STORAGE_KEY_PRODUCTS = 'bear_cafe_shop_products_demo';
const STORAGE_KEY_ENERGY = 'bear_cafe_shop_energy_demo';

// Default initial showcase demo items
const DEFAULT_PRODUCTS: ShopProduct[] = [
  {
    id: 'demo-prod-1',
    server_id: 'default',
    name: 'Discord Nitro Boost 1 เดือน',
    price: '฿119',
    description: 'โปรโมชั่นพิเศษ รับประกันเต็มเดือน เคลมได้ตลอด 24 ชม.',
    image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
    category: 'Subscription',
    is_available: true,
    order_count: 142,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-prod-2',
    server_id: 'default',
    name: 'คอมมิชชันวาดรูป Chibi น่ารัก',
    price: 'เริ่มต้น ฿150',
    description: 'รับวาดแฟนอาร์ต ตัวละครมาสคอต ส่งไฟล์ความละเอียดสูง 300 DPI',
    image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=60',
    category: 'Art & Design',
    is_available: true,
    order_count: 58,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-prod-3',
    server_id: 'default',
    name: 'บริการเขียนบอท Discord สั่งทำ',
    price: 'เริ่มต้น ฿300',
    description: 'ระบบมินิเกม ระบบแจ้งเตือน ระบบจัดการคลังสินค้าออนไลน์ รวดเร็วปลอดภัย',
    image_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60',
    category: 'Bot & System',
    is_available: true,
    order_count: 24,
    created_at: new Date().toISOString(),
  },
];

export function getShopProducts(serverId: string): ShopProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    const allProducts: ShopProduct[] = raw ? JSON.parse(raw) : DEFAULT_PRODUCTS;
    const filtered = allProducts.filter((p) => p.server_id === serverId || p.server_id === 'default');
    return filtered.length > 0 ? filtered : DEFAULT_PRODUCTS;
  } catch {
    return DEFAULT_PRODUCTS;
  }
}

export function saveShopProduct(product: Omit<ShopProduct, 'id' | 'created_at'> & { id?: string }): ShopProduct {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    const allProducts: ShopProduct[] = raw ? JSON.parse(raw) : [...DEFAULT_PRODUCTS];

    if (product.id) {
      // Edit existing
      const index = allProducts.findIndex((p) => p.id === product.id);
      if (index !== -1) {
        allProducts[index] = {
          ...allProducts[index],
          ...product,
        };
        localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(allProducts));
        return allProducts[index];
      }
    }

    // Create new
    const newProduct: ShopProduct = {
      ...product,
      id: `prod-${Date.now()}`,
      created_at: new Date().toISOString(),
      order_count: 0,
    };
    allProducts.unshift(newProduct);
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(allProducts));
    return newProduct;
  } catch {
    return {
      ...product,
      id: `prod-${Date.now()}`,
      created_at: new Date().toISOString(),
      order_count: 0,
    };
  }
}

export function deleteShopProduct(productId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (!raw) return;
    const allProducts: ShopProduct[] = JSON.parse(raw);
    const updated = allProducts.filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete shop product', err);
  }
}

export function getShopEnergy(serverId: string): ShopEnergyState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_ENERGY}_${serverId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // fallback
  }

  // Default energy state for demo
  return {
    serverId,
    daysRemaining: 6,
    totalViews: 48,
    todayViews: 7,
    isSleeping: false,
  };
}

export function boostShopEnergy(serverId: string): ShopEnergyState {
  const current = getShopEnergy(serverId);
  const updated: ShopEnergyState = {
    ...current,
    daysRemaining: Math.min(7, current.daysRemaining + 2),
    todayViews: current.todayViews + 1,
    totalViews: current.totalViews + 1,
    lastBoostAt: new Date().toISOString(),
    isSleeping: false,
  };

  try {
    localStorage.setItem(`${STORAGE_KEY_ENERGY}_${serverId}`, JSON.stringify(updated));
  } catch {
    // ignore
  }

  return updated;
}

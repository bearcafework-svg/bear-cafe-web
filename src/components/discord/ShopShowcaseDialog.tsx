import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Share2,
  Zap,
  Check,
  Copy,
  Users,
  ShieldCheck,
  Handshake,
  Tag,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getShopProducts,
  saveShopProduct,
  deleteShopProduct,
  getShopEnergy,
  boostShopEnergy,
  type ShopProduct,
  type ShopEnergyState,
} from '@/lib/mock-shop-products';
import { EditProductModal } from './EditProductModal';
import { cn } from '@/lib/utils';

interface DiscordServerLike {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  member_count: number | null;
  is_verified?: boolean;
  is_partner?: boolean;
  owner_id?: string;
  invite_url?: string;
}

interface ShopShowcaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: DiscordServerLike | null;
  isOwner?: boolean;
  onJoinDiscord?: (server: DiscordServerLike) => void;
}

export function ShopShowcaseDialog({
  open,
  onOpenChange,
  server,
  isOwner = true, // Default to true in demo so user can test adding products
  onJoinDiscord,
}: ShopShowcaseDialogProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [energy, setEnergy] = useState<ShopEnergyState | null>(null);
  const [editProduct, setEditProduct] = useState<ShopProduct | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (server && open) {
      setProducts(getShopProducts(server.id));
      setEnergy(getShopEnergy(server.id));
    }
  }, [server, open]);

  if (!server) return null;

  const handleSaveProduct = (
    productData: Omit<ShopProduct, 'id' | 'created_at'> & { id?: string }
  ) => {
    const saved = saveShopProduct(productData);
    setProducts(getShopProducts(server.id));
    toast({
      title: productData.id ? 'แก้ไขสินค้าสำเร็จ' : 'เพิ่มสินค้าสำเร็จ ✨',
      description: `สินค้า "${saved.name}" พร้อมแสดงในตู้โชว์แล้ว`,
    });
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    deleteShopProduct(productId);
    setProducts(getShopProducts(server.id));
    toast({
      title: 'ลบสินค้าสำเร็จ',
      description: `นำ "${productName}" ออกจากตู้โชว์แล้ว`,
    });
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/?shop=${server.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);

    toast({
      title: 'คัดลอกลิงก์ร้านค้าแล้ว 📋',
      description: 'นำลิงก์นี้ไปแปะใน Discord เมื่อมีคนคลิกจะช่วยเติมพลังงานร้าน!',
    });
  };

  const handleBoostEnergy = () => {
    const updated = boostShopEnergy(server.id);
    setEnergy(updated);
    toast({
      title: 'ชาร์จพลังงานสำเร็จ ⚡',
      description: `พลังงานร้านค้าเพิ่มขึ้นเป็น ${updated.daysRemaining} วันแล้ว!`,
    });
  };

  const energyPercent = energy ? Math.min(100, (energy.daysRemaining / 7) * 100) : 80;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden rounded-3xl border border-latte/40 dark:border-[#2A221E] bg-card/95 dark:bg-[#161210]/95 backdrop-blur-2xl shadow-2xl max-h-[90vh] flex flex-col">
          {/* Header Banner */}
          <div className="relative h-28 sm:h-36 shrink-0 overflow-hidden bg-stone-900">
            {server.banner_url ? (
              <img
                src={server.banner_url}
                alt={server.name}
                className="w-full h-full object-cover opacity-60"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-honey/30 via-peach/30 to-blush/30" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-card dark:from-[#161210] via-card/60 dark:via-[#161210]/60 to-transparent" />

            {/* Top Close / Actions Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <Badge className="bg-black/50 text-white backdrop-blur-md border border-white/20 text-xs">
                🛍️ ตู้โชว์ร้านค้า
              </Badge>
            </div>
          </div>

          {/* Shop Profile & Info Row */}
          <div className="px-4 sm:px-6 -mt-10 sm:-mt-12 relative z-10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex items-end gap-3 sm:gap-4">
                {/* Icon */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-3 border-card dark:border-[#161210] shadow-xl bg-stone-900 shrink-0 ring-1 ring-primary/30">
                  {server.icon_url ? (
                    <img
                      src={server.icon_url}
                      alt={server.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl bg-amber-500/20 text-amber-500 font-bold">
                      {server.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name & Badges */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="text-base sm:text-xl font-black text-foreground truncate">
                      {server.name}
                    </h2>
                    {server.is_partner && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-200 border border-purple-300">
                        <Handshake className="w-3 h-3" /> Partner
                      </span>
                    )}
                    {server.is_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 border border-sky-300">
                        <ShieldCheck className="w-3 h-3" /> ยืนยันแล้ว
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {server.description || 'ยินดีต้อนรับสู่ร้านค้าของเราบน Discord'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleCopyShareLink}
                  variant="outline"
                  size="sm"
                  className="rounded-full text-xs h-9 gap-1.5 border-latte/50 hover:bg-muted"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>แชร์ลิงก์ร้าน</span>
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => onJoinDiscord?.(server)}
                  size="sm"
                  className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-4 shadow-sm shadow-primary/20"
                >
                  <span>เข้าดิสคอร์ดร้าน</span>
                  <ExternalLink className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>

            {/* 🔋 Shop Energy & Heartbeat Gauge Card */}
            <div className="p-3 sm:p-3.5 rounded-2xl border border-latte/40 dark:border-[#2A221E] bg-latte/15 dark:bg-black/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>หลอดพลังงานร้านค้า (Shop Energy)</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    คงเหลือ {energy?.daysRemaining ?? 6} วัน
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 rounded-full bg-latte/30 dark:bg-stone-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      energyPercent > 40 ? 'bg-gradient-to-r from-amber-500 to-emerald-500' : 'bg-destructive'
                    )}
                    style={{ width: `${energyPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>ทุกๆ การแชร์หรือคลิกเข้าชมจากภายนอก จะช่วยต่ออายุตู้โชว์สินค้าอัตโนมัติ</span>
                </p>
              </div>

              {/* Owner Quick Boost Button */}
              {isOwner && (
                <Button
                  onClick={handleBoostEnergy}
                  variant="secondary"
                  size="sm"
                  className="rounded-full text-xs font-semibold h-8 shrink-0 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  <span>ทดสอบชาร์จพลังงาน</span>
                </Button>
              )}
            </div>
          </div>

          {/* 🛍️ Product Showcase Grid Content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  รายการสินค้าและบริการเด่น ({products.length}/6)
                </h3>
              </div>

              {isOwner && products.length < 6 && (
                <Button
                  onClick={() => {
                    setEditProduct(null);
                    setIsEditModalOpen(true);
                  }}
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มสินค้า</span>
                </Button>
              )}
            </div>

            {/* Products List */}
            {products.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-border/60 space-y-2">
                <div className="text-4xl">🛍️</div>
                <p className="text-sm font-semibold text-foreground">ยังไม่มีสินค้าในตู้โชว์</p>
                <p className="text-xs text-muted-foreground">เจ้าของร้านสามารถเพิ่มสินค้าเด่นได้สูงสุด 6 ชิ้น</p>
                {isOwner && (
                  <Button
                    onClick={() => {
                      setEditProduct(null);
                      setIsEditModalOpen(true);
                    }}
                    size="sm"
                    className="rounded-full bg-primary text-primary-foreground text-xs mt-2"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    เพิ่มสินค้าชิ้นแรก
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="group rounded-2xl border border-latte/30 dark:border-[#2A221E] bg-card dark:bg-[#1A1513] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    {/* Image */}
                    <div className="relative h-28 sm:h-32 w-full overflow-hidden bg-stone-900">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl bg-amber-500/10 text-amber-500">
                          📦
                        </div>
                      )}
                      {item.category && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-md">
                          {item.category}
                        </span>
                      )}
                      <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full text-xs font-black bg-primary text-primary-foreground shadow-md">
                        {item.price}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                          {item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </p>
                      </div>

                      {/* Action buttons inside card */}
                      <div className="pt-2 flex items-center justify-between gap-2 border-t border-border/40">
                        {isOwner ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditProduct(item);
                                setIsEditModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs flex items-center gap-1"
                              title="แก้ไขสินค้า"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span className="text-[10px]">แก้ไข</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(item.id, item.name)}
                              className="p-1.5 rounded-lg text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors text-xs flex items-center gap-1"
                              title="ลบสินค้า"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="text-[10px]">ลบ</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">พร้อมจำหน่าย</span>
                        )}

                        <Button
                          size="sm"
                          onClick={() => onJoinDiscord?.(server)}
                          className="rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-[11px] h-7 px-2.5 font-semibold"
                        >
                          <span>สั่งซื้อในดิสคอร์ด</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Add Modal */}
      <EditProductModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        product={editProduct}
        serverId={server.id}
        onSave={handleSaveProduct}
      />
    </>
  );
}

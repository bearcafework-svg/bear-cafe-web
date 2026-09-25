import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tag, DollarSign, Image as ImageIcon, Sparkles, Check, X } from 'lucide-react';
import type { ShopProduct } from '@/lib/mock-shop-products';

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ShopProduct | null;
  serverId: string;
  onSave: (productData: Omit<ShopProduct, 'id' | 'created_at'> & { id?: string }) => void;
}

const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=500&auto=format&fit=crop&q=60',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
];

export function EditProductModal({
  open,
  onOpenChange,
  product,
  serverId,
  onSave,
}: EditProductModalProps) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setPrice(product.price || '');
      setDescription(product.description || '');
      setImageUrl(product.image_url || '');
      setCategory(product.category || '');
      setIsAvailable(product.is_available ?? true);
    } else {
      setName('');
      setPrice('');
      setDescription('');
      setImageUrl(SAMPLE_IMAGES[0]);
      setCategory('สินค้าแนะนำ');
      setIsAvailable(true);
    }
  }, [product, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim()) return;

    onSave({
      id: product?.id,
      server_id: serverId,
      name: name.trim(),
      price: price.trim(),
      description: description.trim(),
      image_url: imageUrl.trim() || SAMPLE_IMAGES[0],
      category: category.trim() || 'สินค้าทั่วไป',
      is_available: isAvailable,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full p-4 sm:p-6 rounded-3xl border border-latte/40 dark:border-[#2A221E] bg-card/95 backdrop-blur-2xl shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-foreground">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>{product ? 'แก้ไขสินค้าในตู้โชว์' : 'เพิ่มสินค้าเด่นใหม่'}</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            โชว์สินค้าหรือบริการขายดีของคุณให้ลูกค้าเห็นก่อนกดเข้าดิสคอร์ด
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Product Name */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-name" className="text-xs font-semibold text-foreground">
              ชื่อสินค้าหรือบริการ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="prod-name"
              placeholder="เช่น Discord Nitro 1 เดือน / รับวาดรูป..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl bg-background/70 border-border text-xs sm:text-sm h-10"
              required
            />
          </div>

          {/* Price & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price" className="text-xs font-semibold text-foreground">
                ราคา <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="prod-price"
                  placeholder="เช่น ฿99 / เริ่มต้น ฿150"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-8 rounded-xl bg-background/70 border-border text-xs sm:text-sm h-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-cat" className="text-xs font-semibold text-foreground">
                หมวดหมู่
              </Label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="prod-cat"
                  placeholder="เช่น เติมเกม / Art"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="pl-8 rounded-xl bg-background/70 border-border text-xs sm:text-sm h-10"
                />
              </div>
            </div>
          </div>

          {/* Image URL & Sample Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-image" className="text-xs font-semibold text-foreground">
              ลิงก์รูปภาพตัวอย่าง (URL)
            </Label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                id="prod-image"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="pl-8 rounded-xl bg-background/70 border-border text-xs sm:text-sm h-10"
              />
            </div>
            {/* Sample Image Quick Click */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-muted-foreground">รูปตัวอย่าง:</span>
              <div className="flex gap-1.5 overflow-x-auto">
                {SAMPLE_IMAGES.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImageUrl(img)}
                    className="w-7 h-7 rounded-lg overflow-hidden border border-border hover:border-primary shrink-0 transition-transform active:scale-90"
                  >
                    <img src={img} alt="sample" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="prod-desc" className="text-xs font-semibold text-foreground">
              รายละเอียดสั้นๆ
            </Label>
            <Textarea
              id="prod-desc"
              placeholder="เขียนรายละเอียดสั้นๆ หรือเงื่อนไขโปรโมชั่น..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="rounded-xl bg-background/70 border-border text-xs sm:text-sm resize-none"
            />
          </div>

          <DialogFooter className="pt-2 flex sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full h-9 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-9 text-xs px-5 shadow-sm shadow-primary/20"
            >
              <Check className="w-4 h-4 mr-1.5" />
              <span>{product ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

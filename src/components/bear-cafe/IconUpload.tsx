import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { compressImage } from '@/lib/image-compress';

interface IconUploadProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  folder?: string;
}

export function IconUpload({
  value,
  onChange,
  label = 'ไอคอน',
  placeholder = '📁',
  folder = 'icons',
}: IconUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isImageUrl = value?.startsWith('http') || value?.startsWith('blob:');

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'ไฟล์ไม่ถูกต้อง',
        description: 'กรุณาเลือกไฟล์รูปภาพ',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Auto-compress if needed (max 2MB, 512x512 for icons)
      // Preserve PNG transparency by keeping outputType as 'image/png'
      let processed = file;
      if (file.size > 2 * 1024 * 1024 || file.type === 'image/png' || file.type === 'image/bmp') {
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        processed = await compressImage(file, {
          maxWidth: 512,
          maxHeight: 512,
          maxSizeBytes: 2 * 1024 * 1024,
          outputType,
        });
      }

      const fileExt = processed.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('icons')
        .upload(fileName, processed, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('icons')
        .getPublicUrl(data.path);

      onChange(urlData.publicUrl);
      toast({ title: 'อัปโหลดสำเร็จ' });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'อัปโหลดไม่สำเร็จ',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function clearImage(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onChange(placeholder);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 items-start sm:flex-row">
        {/* Preview */}
        <div
          className={cn(
            'w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center',
            'bg-muted/50 overflow-hidden shrink-0',
            isImageUrl ? 'border-primary' : 'border-border'
          )}
        >
          {isImageUrl ? (
            <img
              src={value}
              alt="Icon preview"
              className="w-full h-full object-contain bg-transparent"
            />
          ) : (
            <span className="text-3xl">{value || placeholder}</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex-1 space-y-2 min-w-0">
          {/* Emoji input */}
          <Input
            value={isImageUrl ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="text-center text-xl"
            disabled={isImageUrl}
          />

          {/* File upload */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              อัปโหลดรูป
            </Button>
            {isImageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => clearImage(e)}
                onMouseDown={(e) => e.stopPropagation()}
                className="gap-1 w-full sm:w-auto"
              >
                <X className="w-4 h-4" />
                ลบรูป
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

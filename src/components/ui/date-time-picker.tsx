import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DateTimePickerProps {
  value?: string; // YYYY-MM-DDTHH:mm
  onChange?: (dateTime: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePicker({ value, onChange, placeholder = "วว/ดด/ปปปป --:--", className, disabled }: DateTimePickerProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Split value into date (YYYY-MM-DD) and time (HH:mm) parts
  const { datePart, timePart } = React.useMemo(() => {
    if (!value) return { datePart: "", timePart: "00:00" };
    const parts = value.split('T');
    return {
      datePart: parts[0] || "",
      timePart: parts[1] ? parts[1].substring(0, 5) : "00:00"
    };
  }, [value]);

  const [hour, minute] = React.useMemo(() => {
    const parts = timePart.split(':');
    return [parts[0] || "00", parts[1] || "00"];
  }, [timePart]);

  // Sync value -> display string dd/MM/yyyy HH:mm
  React.useEffect(() => {
    if (value) {
      const parts = value.split('T');
      if (parts.length === 2) {
        const dateStr = parts[0];
        const timeStr = parts[1].substring(0, 5);
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
          setInputValue(`${dateParts[2].padStart(2, '0')}/${dateParts[1].padStart(2, '0')}/${dateParts[0]} ${timeStr}`);
          return;
        }
      }
    }
    setInputValue("");
  }, [value]);

  const dateValue = React.useMemo(() => {
    if (!datePart) return undefined;
    const parts = datePart.split('-');
    if (parts.length !== 3) return undefined;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }, [datePart]);

  // Handle typing inside input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    
    // Allow digits, slashes, spaces, and colons
    text = text.replace(/[^0-9/ :]/g, "");
    
    // Auto-insert slash / space / colon formats for convenience
    // Format: dd/MM/yyyy HH:mm
    if (text.length === 2 && !text.includes("/")) {
      text = text + "/";
    } else if (text.length === 5 && text.split("/").length === 2) {
      text = text + "/";
    } else if (text.length === 10 && !text.includes(" ")) {
      text = text + " ";
    } else if (text.length === 13 && !text.includes(":")) {
      text = text + ":";
    }
    
    if (text.length > 16) {
      text = text.slice(0, 16);
    }
    
    setInputValue(text);

    // Validate if it is a complete dd/MM/yyyy HH:mm
    if (text.length === 16) {
      const parsedDate = parse(text, "dd/MM/yyyy HH:mm", new Date());
      if (isValid(parsedDate)) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        const h = String(parsedDate.getHours()).padStart(2, '0');
        const m = String(parsedDate.getMinutes()).padStart(2, '0');
        onChange?.(`${year}-${month}-${day}T${h}:${m}`);
      }
    } else if (text === "") {
      onChange?.("");
    }
  };

  const handleSelectDate = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange?.(`${year}-${month}-${day}T${hour}:${minute}`);
    } else {
      onChange?.("");
    }
  };

  const handleSelectTime = (newHour: string, newMinute: string) => {
    if (datePart) {
      onChange?.(`${datePart}T${newHour}:${newMinute}`);
    } else {
      // If no date selected, default to today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      onChange?.(`${year}-${month}-${day}T${newHour}:${newMinute}`);
    }
  };

  // Generate hours (00-23) and minutes (00-59)
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pr-10 border-latte/40 rounded-xl text-sm h-10 bg-background"
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            className="absolute right-1 top-1 h-8 w-8 hover:bg-cream/20 text-[#8C6239] rounded-lg shrink-0"
          >
            <CalendarIcon className="h-4.5 w-4.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-latte/40 rounded-2xl shadow-xl bg-card" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelectDate}
            initialFocus
          />
          {/* Time Picker Controls */}
          <div className="border-t border-latte/20 p-3 bg-muted/20 flex flex-col gap-2 rounded-b-2xl">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-[#8C6239] dark:text-[#EAD8C8] flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5" /> เวลา (24h)
              </span>
              <div className="flex items-center gap-1.5">
                <Select value={hour} onValueChange={(h) => handleSelectTime(h, minute)}>
                  <SelectTrigger className="w-16 h-8 text-xs rounded-lg border-latte/40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 rounded-lg">
                    {hours.map((h) => (
                      <SelectItem key={h} value={h} className="text-xs">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs font-bold text-muted-foreground">:</span>
                <Select value={minute} onValueChange={(m) => handleSelectTime(hour, m)}>
                  <SelectTrigger className="w-16 h-8 text-xs rounded-lg border-latte/40 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48 rounded-lg">
                    {minutes.map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs font-semibold text-amber-700 hover:text-amber-800 hover:bg-cream/10 h-8 rounded-lg mt-1"
              onClick={() => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const h = String(today.getHours()).padStart(2, '0');
                const m = String(today.getMinutes()).padStart(2, '0');
                onChange?.(`${year}-${month}-${day}T${h}:${m}`);
                setPopoverOpen(false);
              }}
            >
              เลือกเวลาปัจจุบัน (Now)
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

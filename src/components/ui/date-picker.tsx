import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange?: (date: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder = "วว/ดด/ปปปป", className, disabled }: DatePickerProps) {
  // Local state for the typed text
  const [inputValue, setInputValue] = React.useState("");
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  // Sync value (YYYY-MM-DD) -> inputValue (dd/MM/yyyy)
  React.useEffect(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const formatted = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        setInputValue(formatted);
      }
    } else {
      setInputValue("");
    }
  }, [value]);

  const dateValue = React.useMemo(() => {
    if (!value) return undefined;
    const parts = value.split('-');
    if (parts.length !== 3) return undefined;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }, [value]);

  // Handle typing inside input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    
    // Automatically format typing e.g. 15072026 -> 15/07/2026
    // Allow digits and slashes
    text = text.replace(/[^0-9/]/g, "");
    
    // Auto-insert slash for convenience
    if (text.length === 2 && !text.includes("/")) {
      text = text + "/";
    } else if (text.length === 5 && text.split("/").length === 2) {
      text = text + "/";
    }
    
    // Cap length at 10 (dd/MM/yyyy)
    if (text.length > 10) {
      text = text.slice(0, 10);
    }
    
    setInputValue(text);

    // Validate if it is a complete dd/MM/yyyy
    if (text.length === 10) {
      const parsedDate = parse(text, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        onChange?.(`${year}-${month}-${day}`);
      }
    } else if (text === "") {
      onChange?.("");
    }
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      onChange?.(`${year}-${month}-${day}`);
      setPopoverOpen(false);
    } else {
      onChange?.("");
    }
  };

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
            className="absolute right-1 top-1 h-8 w-8 hover:bg-cream/20 text-amber-700 rounded-lg shrink-0"
          >
            <CalendarIcon className="h-4.5 w-4.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 border-latte/40 rounded-2xl shadow-xl bg-card" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

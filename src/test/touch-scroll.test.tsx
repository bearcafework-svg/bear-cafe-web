import { describe, it, expect } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RichSelect } from '@/components/ui/rich-select';
import { initTouchScrollFix } from '@/lib/touch-scroll-lock-fix';

window.HTMLElement.prototype.scrollIntoView = function() {};
window.HTMLElement.prototype.hasPointerCapture = function() { return false; };
window.HTMLElement.prototype.setPointerCapture = function() {};
window.HTMLElement.prototype.releasePointerCapture = function() {};

initTouchScrollFix();

describe('Touch Scroll in Nested Overlays', () => {
  it('checks if touchmove is prevented when Popover is inside Dialog', async () => {
    function TestComponent() {
      const [dialogOpen, setDialogOpen] = useState(true);
      return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <h2>Dialog Content</h2>
            <RichSelect
              data={[
                { id: '1', label: 'Item 1', value: '1' },
                { id: '2', label: 'Item 2', value: '2' },
                { id: '3', label: 'Item 3', value: '3' },
              ]}
              defaultValue="1"
            />
          </DialogContent>
        </Dialog>
      );
    }

    render(<TestComponent />);

    // Open the RichSelect dropdown
    const trigger = screen.getByRole('button', { name: /Item 1/i });
    fireEvent.click(trigger);

    // Find an item inside the popover
    const item = await screen.findByText('Item 2');
    expect(item).toBeInTheDocument();

    // Create a touchmove event
    const touchMoveEvent = new CustomEvent('touchmove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchMoveEvent, 'touches', {
      value: [{ clientX: 100, clientY: 100 }],
    });
    Object.defineProperty(touchMoveEvent, 'changedTouches', {
      value: [{ clientX: 100, clientY: 100 }],
    });

    // Spy on preventDefault
    const originalPreventDefault = touchMoveEvent.preventDefault.bind(touchMoveEvent);
    touchMoveEvent.preventDefault = () => {
      console.log('>>> PREVENT DEFAULT CALLED! Trace:\n', new Error().stack);
      originalPreventDefault();
    };

    item.dispatchEvent(touchMoveEvent);

    console.log('TEST RESULT touchMoveEvent.defaultPrevented:', touchMoveEvent.defaultPrevented);
    console.log('TEST RESULT document.body style pointerEvents:', document.body.style.pointerEvents);
    console.log('TEST RESULT item computed pointerEvents:', window.getComputedStyle(item).pointerEvents);
    const popoverContent = item.closest('[role="dialog"]');
    if (popoverContent) {
      console.log('TEST RESULT popoverContent computed pointerEvents:', window.getComputedStyle(popoverContent).pointerEvents);
    }
  });

  it('checks if touchmove is prevented when Select is inside Dialog', async () => {
    const { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } = await import('@/components/ui/select');

    function SelectTestComponent() {
      const [dialogOpen, setDialogOpen] = useState(true);
      return (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <h2>Dialog Content</h2>
            <Select defaultValue="1">
              <SelectTrigger>
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Option 1</SelectItem>
                <SelectItem value="2">Option 2</SelectItem>
                <SelectItem value="3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      );
    }

    render(<SelectTestComponent />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const option = await screen.findByText('Option 2');
    expect(option).toBeInTheDocument();

    const touchMoveEvent = new CustomEvent('touchmove', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(touchMoveEvent, 'touches', {
      value: [{ clientX: 100, clientY: 100 }],
    });
    Object.defineProperty(touchMoveEvent, 'changedTouches', {
      value: [{ clientX: 100, clientY: 100 }],
    });

    option.dispatchEvent(touchMoveEvent);

    console.log('TEST RESULT SELECT touchMoveEvent.defaultPrevented:', touchMoveEvent.defaultPrevented);
    expect(touchMoveEvent.defaultPrevented).toBe(false);
  });
});

/**
 * 📱 Global Touch Scroll Fix for Mobile & iPad (Radix UI / react-remove-scroll)
 *
 * Problem:
 * When Radix Dialog / Sheet / Modal opens, `react-remove-scroll` attaches a non-passive
 * `touchmove` listener to `document`. Any portaled child (Select, Popover, RichSelect,
 * DropdownMenu, DatePicker) is considered "outside" the lockRef, causing `react-remove-scroll`
 * to call `event.preventDefault()` on every touch gesture on mobile Safari / iPadOS / Chrome.
 * This completely freezes touch scrolling for all dropdown options in `/admin`.
 *
 * Solution:
 * In the DOM event bubble chain:
 *   target -> ... -> document.body -> document (react-remove-scroll) -> window
 *
 * By intercepting `touchmove` on `document.body` and stopping propagation ONLY when
 * the touch originates inside an overlay / dropdown / scrollable element, we prevent
 * `react-remove-scroll` on `document` from ever receiving the event and calling `preventDefault()`.
 * This allows the browser's native momentum touch scrolling engine to scroll freely.
 */
export function initTouchScrollFix() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const handleTouchMove = (e: TouchEvent) => {
    const target = e.target as Element | null;
    if (!target) return;

    // Check if touch originates inside ANY Radix dropdown, select, popover, menu, or scrollable overlay
    const isInsideScrollableOverlay = target.closest(
      '[data-radix-popper-content-wrapper], [data-radix-select-viewport], [role="listbox"], [role="menu"], [role="dialog"], [data-touch-scroll="true"], .overflow-y-auto, .overflow-auto'
    );

    if (isInsideScrollableOverlay) {
      // Stop bubbling to document so react-remove-scroll cannot call preventDefault()
      e.stopPropagation();
    }
  };

  // Attach to document.body in bubbling phase (runs BEFORE document listeners)
  if (document.body) {
    document.body.addEventListener('touchmove', handleTouchMove, { passive: false });
  } else {
    window.addEventListener('DOMContentLoaded', () => {
      document.body?.addEventListener('touchmove', handleTouchMove, { passive: false });
    });
  }
}

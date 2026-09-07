import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SubMenuItem {
  id?: string;
  label: string;
  description: string;
  icon: React.ElementType;
  link?: string;
  onClick?: () => void;
}

export interface SubMenu {
  title: string;
  items: SubMenuItem[];
}

export interface NavItem {
  id: string | number;
  label: string;
  link?: string;
  subMenus?: SubMenu[];
  onClick?: () => void;
}

export interface DropdownNavigationProps {
  navItems: NavItem[];
  activeId?: string;
  onItemClick?: (id: string) => void;
  className?: string;
}

export function DropdownNavigation({
  navItems,
  activeId,
  onItemClick,
  className,
}: DropdownNavigationProps) {
  const [openNavId, setOpenNavId] = useState<string | number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (id: string | number, hasSub: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hasSub) {
      setOpenNavId(id);
    } else {
      setOpenNavId(null);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpenNavId(null);
    }, 180);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenNavId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const currentOpenItem = navItems.find((item) => item.id === openNavId);

  return (
    <div
      ref={containerRef}
      onMouseLeave={handleMouseLeave}
      className={cn('relative z-40', className)}
    >
      {/* Top Navbar Row */}
      <nav className="flex items-center gap-1 p-1.5 rounded-2xl bg-white/75 dark:bg-[#15110E]/80 backdrop-blur-xl border border-amber-950/10 dark:border-[#2C221D]/80 shadow-sm">
        {navItems.map((item) => {
          const hasSub = Boolean(item.subMenus && item.subMenus.length > 0);
          const isOpen = openNavId === item.id;
          const isItemActive =
            hasSub &&
            item.subMenus?.some((sub) =>
              sub.items.some((subItem) => subItem.id === activeId)
            );

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => handleMouseEnter(item.id, hasSub)}
            >
              <button
                type="button"
                onClick={() => {
                  if (hasSub) {
                    setOpenNavId(isOpen ? null : item.id);
                  } else if (item.onClick) {
                    item.onClick();
                  } else if (item.link) {
                    window.location.href = item.link;
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 select-none',
                  isOpen
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                    : isItemActive
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-500/10'
                )}
              >
                <span>{item.label}</span>
                {hasSub && (
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200 opacity-60',
                      isOpen && 'rotate-180 opacity-100 text-amber-500'
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Animated Dropdown Mega Menu */}
      <AnimatePresence>
        {currentOpenItem && currentOpenItem.subMenus && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            className="absolute left-0 top-full mt-2 w-max max-w-[92vw] min-w-[300px] sm:min-w-[560px] lg:min-w-[640px] rounded-3xl bg-white/95 dark:bg-[#16120E]/95 backdrop-blur-2xl border border-amber-950/10 dark:border-[#2C221D] shadow-2xl shadow-black/20 p-4 sm:p-5 overflow-hidden z-50"
          >
            <div
              className={cn(
                'grid gap-6',
                currentOpenItem.subMenus.length === 1
                  ? 'grid-cols-1'
                  : currentOpenItem.subMenus.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              )}
            >
              {currentOpenItem.subMenus.map((subMenu, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 pb-1 border-b border-stone-200/60 dark:border-[#2C221D]/60">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      {subMenu.title}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    {subMenu.items.map((subItem, itemIdx) => {
                      const Icon = subItem.icon;
                      const isSubActive = activeId && subItem.id === activeId;

                      return (
                        <button
                          key={itemIdx}
                          type="button"
                          onClick={() => {
                            setOpenNavId(null);
                            if (subItem.onClick) {
                              subItem.onClick();
                            } else if (subItem.id && onItemClick) {
                              onItemClick(subItem.id);
                            } else if (subItem.link) {
                              window.location.href = subItem.link;
                            }
                          }}
                          className={cn(
                            'w-full flex items-start gap-3 p-2.5 rounded-2xl text-left transition-all group',
                            isSubActive
                              ? 'bg-amber-500/15 border border-amber-500/30 text-stone-900 dark:text-white'
                              : 'hover:bg-amber-500/10 dark:hover:bg-amber-500/10 border border-transparent'
                          )}
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                              isSubActive
                                ? 'bg-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20'
                                : 'bg-stone-500/10 dark:bg-stone-800/60 text-stone-600 dark:text-stone-300 group-hover:bg-amber-500/20 group-hover:text-amber-500'
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-xs sm:text-sm font-semibold truncate',
                                  isSubActive
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-stone-800 dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                                )}
                              >
                                {subItem.label}
                              </span>
                              {isSubActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              )}
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-tight mt-0.5">
                              {subItem.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DropdownNavigation;

import { useState, useCallback, useMemo } from 'react';

interface UseBulkSelectionOptions<T> {
  items: T[];
  getItemId: (item: T) => string;
}

export function useBulkSelection<T>({ items, getItemId }: UseBulkSelectionOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length && items.length > 0) {
        return new Set();
      }
      return new Set(items.map(getItemId));
    });
  }, [items, getItemId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(getItemId)));
  }, [items, getItemId]);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const isAllSelected = useMemo(
    () => items.length > 0 && selectedIds.size === items.length,
    [items.length, selectedIds.size]
  );

  const isSomeSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds.size, items.length]
  );

  const selectedCount = selectedIds.size;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(getItemId(item))),
    [items, selectedIds, getItemId]
  );

  return {
    selectedIds,
    selectedCount,
    selectedItems,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleItem,
    toggleAll,
    clearSelection,
    selectAll,
  };
}

import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface DraggableRulesListProps {
  rules: string[];
  onChange: (rules: string[]) => void;
}

export function DraggableRulesList({ rules, onChange }: DraggableRulesListProps) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(rules);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onChange(items);
  };

  const handleAddRule = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // Use setTimeout to escape any event capture from parent dialog
    setTimeout(() => {
      onChange([...rules, ' ']); // Use space as placeholder to ensure it's not filtered
    }, 0);
  };

  const handleUpdateRule = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index] = value;
    onChange(newRules);
  };

  const handleDeleteRule = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setTimeout(() => {
      const newRules = rules.filter((_, i) => i !== index);
      onChange(newRules);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <Label>กฎการใช้งาน</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRule}
          className="gap-1"
        >
          <Plus className="w-3 h-3" />
          เพิ่มกฎ
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          ยังไม่มีกฎ คลิก "เพิ่มกฎ" เพื่อเพิ่มกฎใหม่
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="rules">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2 max-h-48 overflow-y-auto"
              >
                {rules.map((rule, index) => (
                  <Draggable key={`rule-${index}`} draggableId={`rule-${index}`} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`flex items-center gap-2 p-2 rounded-lg border bg-background ${
                          snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                        }`}
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>
                        <span className="text-muted-foreground text-sm w-6 shrink-0">
                          {index + 1}.
                        </span>
                        <Input
                          value={rule}
                          onChange={(e) => handleUpdateRule(index, e.target.value)}
                          placeholder="ระบุกฎข้อนี้..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDeleteRule(index, e)}
                          className="text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <p className="text-xs text-muted-foreground">
        ลากเพื่อจัดลำดับกฎ • กฎเหล่านี้จะแสดงในหน้า "กติกาและข้อตกลง" ก่อนสร้างแมตช์
      </p>
    </div>
  );
}

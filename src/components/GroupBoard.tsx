"use client";

import { useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Contact } from "@/lib/types";
import { WEEKDAYS } from "@/lib/types";
import { saveMembership } from "@/app/a/[secret]/groups/actions";

const UNGROUPED = "__ungrouped__";
type Items = Record<string, Contact[]>;

export interface GroupMeta {
  id: string;
  name: string;
  send_weekday: number | null;
}

export default function GroupBoard({
  basePath,
  groups,
  initialItems,
}: {
  basePath: string;
  groups: GroupMeta[];
  initialItems: Items;
}) {
  const [items, setItemsState] = useState<Items>(initialItems);
  const itemsRef = useRef<Items>(initialItems);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function set(next: Items) {
    itemsRef.current = next;
    setItemsState(next);
  }

  function findContainer(id: UniqueIdentifier): string | undefined {
    const current = itemsRef.current;
    if (id in current) return id as string;
    return Object.keys(current).find((k) => current[k].some((c) => c.id === id));
  }

  function persist(next: Items) {
    const assignments = groups.map((g) => ({
      groupId: g.id,
      contactIds: (next[g.id] ?? []).map((c) => c.id),
    }));
    setSaving(true);
    saveMembership(basePath, assignments)
      .catch((err) => console.error("Failed to save groups:", err))
      .finally(() => setSaving(false));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;

    const prev = itemsRef.current;
    const fromItems = prev[from];
    const toItems = prev[to];
    const moving = fromItems.find((c) => c.id === active.id);
    if (!moving) return;

    const overIndex = toItems.findIndex((c) => c.id === over.id);
    const insertAt = overIndex >= 0 ? overIndex : toItems.length;

    set({
      ...prev,
      [from]: fromItems.filter((c) => c.id !== active.id),
      [to]: [...toItems.slice(0, insertAt), moving, ...toItems.slice(insertAt)],
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    const prev = itemsRef.current;

    if (over) {
      const from = findContainer(active.id);
      const to = findContainer(over.id);
      if (from && to && from === to) {
        const arr = prev[from];
        const oldIndex = arr.findIndex((c) => c.id === active.id);
        const newIndex = arr.findIndex((c) => c.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          set({ ...prev, [from]: arrayMove(arr, oldIndex, newIndex) });
        }
      }
    }
    persist(itemsRef.current);
  }

  const activeContact = Object.values(items)
    .flat()
    .find((c) => c.id === activeId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          Drag people between groups to set who gets invited when.
        </p>
        <span className="text-xs text-stone-400">
          {saving ? "Saving…" : "Saved"}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Container
              key={g.id}
              id={g.id}
              title={g.name}
              subtitle={
                g.send_weekday != null
                  ? `Emails ${WEEKDAYS[g.send_weekday]}`
                  : "No send day set"
              }
              items={items[g.id] ?? []}
            />
          ))}
        </div>

        <div className="mt-4">
          <Container
            id={UNGROUPED}
            title="Ungrouped"
            subtitle="Not on any list — drag into a group"
            items={items[UNGROUPED] ?? []}
            muted
          />
        </div>

        <DragOverlay>
          {activeContact ? <Card contact={activeContact} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Container({
  id,
  title,
  subtitle,
  items,
  muted,
}: {
  id: string;
  title: string;
  subtitle: string;
  items: Contact[];
  muted?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      className={`rounded-xl border ${
        muted ? "border-dashed border-stone-300 bg-stone-50" : "border-stone-200 bg-white"
      }`}
    >
      <header className="border-b border-stone-100 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
            {items.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-400">{subtitle}</p>
      </header>
      <SortableContext
        items={items.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          className={`min-h-[64px] space-y-2 p-3 transition ${
            isOver ? "bg-stone-100" : ""
          }`}
        >
          {items.length === 0 && (
            <li className="px-1 py-2 text-xs text-stone-400">Drop people here</li>
          )}
          {items.map((c) => (
            <SortableItem key={c.id} contact={c} />
          ))}
        </ul>
      </SortableContext>
    </div>
  );
}

function SortableItem({ contact }: { contact: Contact }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: contact.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card contact={contact} grab />
    </li>
  );
}

function Card({
  contact,
  overlay,
  grab,
}: {
  contact: Contact;
  overlay?: boolean;
  grab?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-stone-200 bg-white px-3 py-2 ${
        grab ? "cursor-grab active:cursor-grabbing" : ""
      } ${overlay ? "shadow-lg" : "shadow-sm"}`}
    >
      <p className="truncate text-sm font-medium">{contact.name || contact.email}</p>
      {contact.name && (
        <p className="truncate text-xs text-stone-400">{contact.email}</p>
      )}
    </div>
  );
}

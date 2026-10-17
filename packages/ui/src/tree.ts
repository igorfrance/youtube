import type { InjectionKey, Ref } from 'vue';

export interface UiTreeNode {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  /** Number shown on the right (items in this folder and below). */
  count?: number;
  collapsed?: boolean;
  children: UiTreeNode[];
}

export interface TreeContext {
  selectedId: Ref<string | undefined>;
  dropTargetId: Ref<string | undefined>;
  draggable: Ref<boolean>;
  acceptsDrop: Ref<boolean>;
  select(id: string, e: MouseEvent): void;
  toggle(id: string): void;
  menu(id: string, e: MouseEvent): void;
  dragStart(id: string, e: DragEvent): void;
  dragOver(id: string, e: DragEvent): void;
  dragLeave(id: string): void;
  drop(id: string, e: DragEvent): void;
}

export const TREE_CONTEXT: InjectionKey<TreeContext> = Symbol('tree');

/** Mime type for drag-and-drop payloads between folder trees and item lists. */
export const DRAG_MIME = 'application/x-ytfolders';

export type DragPayload = { kind: 'folder'; id: string } | { kind: 'items'; ids: string[]; from: string | null };

export function readDrag(e: DragEvent): DragPayload | undefined {
  try {
    return JSON.parse(e.dataTransfer?.getData(DRAG_MIME) ?? '') as DragPayload;
  } catch {
    return undefined;
  }
}

export function writeDrag(e: DragEvent, payload: DragPayload): void {
  e.dataTransfer?.setData(DRAG_MIME, JSON.stringify(payload));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

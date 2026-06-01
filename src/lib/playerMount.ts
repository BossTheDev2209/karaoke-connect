interface PlayerMountNode {
  id: string;
  className: string;
}

interface PlayerMountDocument<T extends PlayerMountNode> {
  getElementById: (id: string) => T | null;
  createElement: (tagName: 'div') => T;
}

interface PlayerMountWrapper<T extends PlayerMountNode> {
  appendChild: (node: T) => unknown;
}

// YouTube replaces its mount node with an iframe. Keep that node outside React
// ownership so queue removal cannot make React delete an already-replaced node.
export function ensurePlayerMount<T extends PlayerMountNode>(
  documentRef: PlayerMountDocument<T>,
  wrapper: PlayerMountWrapper<T> | null,
  containerId: string,
): T | null {
  const existing = documentRef.getElementById(containerId);
  if (existing) return existing;
  if (!wrapper) return null;

  const mount = documentRef.createElement('div');
  mount.id = containerId;
  mount.className = 'h-full w-full';
  wrapper.appendChild(mount);
  return mount;
}

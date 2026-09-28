export function rootName(path: string): string {
  const cut = path.search(/[[.]/);

  return cut === -1 ? path : path.slice(0, cut);
}

export function parentPaths(path: string): string[] {
  const parents: string[] = [];
  let parent = path;
  while (true) {
    const cut = Math.max(parent.lastIndexOf('['), parent.lastIndexOf('.'));
    if (cut === -1) break;
    parent = parent.slice(0, cut);
    parents.push(parent);
  }

  return parents;
}

export const containsPath = (parent: string, child: string): boolean =>
  child.length > parent.length &&
  child.startsWith(parent) &&
  (child[parent.length] === '[' || child[parent.length] === '.');

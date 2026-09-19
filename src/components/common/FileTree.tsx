'use client';

import React, { useState } from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';

export interface TreeNode {
  name: string;
  /** Present, even if empty, marks this as a folder. Absent marks it a leaf. */
  children?: TreeNode[];
  /** Right-aligned annotation: a method, a count, a type. */
  meta?: string;
}

/**
 * A hierarchy, for previewing the shape of something imported before committing to it.
 *
 * Built for the parsed OpenAPI spec: the reader needs to see which paths were found and how
 * they nest, and a flat list of forty routes does not show that.
 */
export const FileTree: React.FC<{ nodes: TreeNode[]; className?: string }> = ({
  nodes,
  className = '',
}) => (
  // A plain nested list, not `role="tree"`. This is a read-only preview with nothing to
  // select, and a tree role would promise keyboard selection semantics that do not exist.
  <ul className={`rounded-lg border border-border bg-panel p-2 font-mono text-sm ${className}`}>
    {nodes.map((n, i) => (
      <Node key={`${n.name}-${i}`} node={n} depth={0} />
    ))}
  </ul>
);

const Node: React.FC<{ node: TreeNode; depth: number }> = ({ node, depth }) => {
  const isFolder = Array.isArray(node.children);
  // Open at the top so the shape is visible on arrival; deeper levels stay collapsed.
  const [open, setOpen] = useState(depth < 1);

  return (
    <li>
      {/* Indent with padding rather than nested margins, so a deep tree cannot drift off the
          right edge of its container. A folder is a real button: it toggles, so it has to be
          reachable by keyboard and has to announce whether it is open. */}
      {React.createElement(
        isFolder ? 'button' : 'div',
        {
          ...(isFolder
            ? {
                type: 'button' as const,
                onClick: () => setOpen(o => !o),
                'aria-expanded': open,
              }
            : {}),
          style: { paddingLeft: depth * 16 + 6 },
          className: `flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left ${
            isFolder ? 'cursor-pointer hover:bg-panel-hover' : ''
          }`,
        },
        <>
          {isFolder ? (
            <ChevronRight
              size={12}
              aria-hidden="true"
              className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            />
          ) : (
            <span className="w-3 shrink-0" />
          )}
          {isFolder ? (
            <Folder size={13} className="shrink-0 text-muted" aria-hidden="true" />
          ) : (
            <File size={13} className="shrink-0 text-muted" aria-hidden="true" />
          )}
          <span className="truncate text-main">{node.name}</span>
          {node.meta && (
            <span className="ml-auto shrink-0 pl-3 text-xs text-muted">{node.meta}</span>
          )}
        </>,
      )}

      {isFolder && open && (
        <ul>
          {node.children!.map((c, i) => (
            <Node key={`${c.name}-${i}`} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

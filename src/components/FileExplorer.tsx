"use client";

import { useState, useEffect, useCallback } from "react";
import { Folder, FolderOpen, File } from "lucide-react";
import type { FileNode } from "@/types";

interface FileExplorerProps {
  projectPath: string;
  onFileSelect: (path: string) => void;
}

function SkeletonRow({ depth }: { depth: number }) {
  return (
    <div
      style={{
        height: 28,
        display: "flex",
        alignItems: "center",
        paddingLeft: depth * 16 + 8,
        gap: 8,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: "var(--border)",
        }}
      />
      <div
        style={{
          width: 60 + ((depth * 37 + 41) % 80),
          height: 12,
          borderRadius: 3,
          background: "var(--border)",
          animation: "skeleton-pulse 1.5s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  expandedPaths,
  onToggleDir,
  onFileSelect,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onToggleDir: (path: string) => void;
  onFileSelect: (path: string) => void;
}) {
  const isDir = node.type === "directory";
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.path === selectedPath;

  const extMatch = !isDir ? node.name.match(/(\.[^.]+)$/) : null;
  const baseName = extMatch ? node.name.slice(0, -extMatch[1].length) : node.name;
  const ext = extMatch ? extMatch[1] : "";

  return (
    <>
      <div
        role="treeitem"
        tabIndex={0}
        className="list-item"
        onClick={() => (isDir ? onToggleDir(node.path) : onFileSelect(node.path))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            isDir ? onToggleDir(node.path) : onFileSelect(node.path);
          }
        }}
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          paddingLeft: depth * 16 + 8,
          paddingRight: 8,
          gap: 6,
          background: isSelected ? "var(--border)" : undefined,
        }}
      >
        {isDir ? (
          isExpanded ? (
            <FolderOpen size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
          ) : (
            <Folder size={14} color="var(--text-dim)" style={{ flexShrink: 0 }} />
          )
        ) : (
          <File size={14} color="var(--text-dim)" style={{ flexShrink: 0 }} />
        )}
        <span
          style={{
            fontSize: 13,
            color: isDir && isExpanded ? "var(--accent)" : "var(--text)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            lineHeight: "28px",
          }}
        >
          {baseName}
          {ext && (
            <span style={{ color: "var(--text-dim)" }}>{ext}</span>
          )}
        </span>
      </div>
      {isDir && isExpanded && node.children && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleDir={onToggleDir}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function FileExplorer({ projectPath, onFileSelect }: FileExplorerProps) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectPath) {
      setTree([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTree([]);
    setSelectedPath(null);
    setExpandedPaths(new Set());

    fetch(`/api/files?path=${encodeURIComponent(projectPath)}`)
      .then((res) => res.json())
      .then((data: FileNode[]) => {
        if (!cancelled) {
          setTree(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleFileSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      onFileSelect(path);
    },
    [onFileSelect]
  );

  return (
    <div className="panel-card">
      <div className="panel-card-header">Files</div>
      <div
        role="tree"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          paddingBottom: 8,
        }}
      >
        {loading ? (
          <>
            <SkeletonRow depth={0} />
            <SkeletonRow depth={1} />
            <SkeletonRow depth={1} />
            <SkeletonRow depth={0} />
            <SkeletonRow depth={1} />
            <SkeletonRow depth={2} />
            <SkeletonRow depth={0} />
            <SkeletonRow depth={1} />
          </>
        ) : tree.length === 0 ? (
          <div className="panel-empty">No files found</div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleDir={handleToggleDir}
              onFileSelect={handleFileSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/types";

interface ProjectPickerProps {
  selectedProject: Project | null;
  onProjectSelect: (project: Project) => void;
}

export default function ProjectPicker({
  selectedProject,
  onProjectSelect,
}: ProjectPickerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: Project[]) => {
        if (!cancelled) {
          setProjects(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="panel-card" style={{ height: "auto" }}>
      <div className="panel-card-header">Projects</div>
      <div
        style={{
          overflowY: "auto",
          paddingBottom: 4,
        }}
      >
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                }}
              >
                <div
                  style={{
                    width: 80 + i * 20,
                    height: 12,
                    borderRadius: 3,
                    background: "var(--border)",
                    animation: "skeleton-pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </>
        ) : projects.length === 0 ? (
          <div className="panel-empty">No projects found</div>
        ) : (
          projects.map((project) => {
            const isSelected = selectedProject?.path === project.path;
            return (
              <div
                key={project.path}
                role="button"
                tabIndex={0}
                className={`list-item${isSelected ? " active" : ""}`}
                onClick={() => onProjectSelect(project)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onProjectSelect(project);
                  }
                }}
                style={{
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 12px",
                  background: isSelected ? "var(--accent-dim)" : undefined,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isSelected ? "var(--accent)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: isSelected ? 500 : 400,
                  }}
                >
                  {project.name}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

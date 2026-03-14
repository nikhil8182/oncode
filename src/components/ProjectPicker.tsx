"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/types";
import { withAuthToken } from "@/lib/client-auth";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(withAuthToken("/api/projects"))
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to load projects");
        }
        return res.json();
      })
      .then((data: Project[]) => {
        if (!cancelled) {
          setProjects(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load projects");
          setLoading(false);
        }
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
        ) : error ? (
          <div className="panel-empty" style={{ color: "var(--danger)" }}>Failed to load projects</div>
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

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
    <div
      style={{
        background: "#0f0f0f",
        borderRadius: 8,
        border: "1px solid #1a1a1a",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 12px 6px",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#555",
          textTransform: "uppercase",
        }}
      >
        Projects
      </div>
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
                    background: "#1a1a1a",
                    animation: "pp-skeleton-pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </>
        ) : projects.length === 0 ? (
          <div
            style={{
              padding: "20px 12px",
              fontSize: 13,
              color: "#555",
              textAlign: "center",
            }}
          >
            No projects found
          </div>
        ) : (
          projects.map((project) => {
            const isSelected = selectedProject?.path === project.path;
            return (
              <div
                key={project.path}
                role="button"
                tabIndex={0}
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
                  cursor: "pointer",
                  background: isSelected ? "#0d948815" : "transparent",
                  transition: "background 0.1s",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.background = "#111";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLDivElement).style.background =
                      "transparent";
                  }
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    color: isSelected ? "#0d9488" : "#888",
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
      <style>{`
        @keyframes pp-skeleton-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

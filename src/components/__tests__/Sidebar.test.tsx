import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Sidebar from "../Sidebar";

// Mock lucide-react icons to simple spans so we don't depend on SVG rendering
vi.mock("lucide-react", () => ({
  MessageSquare: (props: Record<string, unknown>) => <span data-testid="icon-message-square" {...props} />,
  FolderTree: (props: Record<string, unknown>) => <span data-testid="icon-folder-tree" {...props} />,
  Terminal: (props: Record<string, unknown>) => <span data-testid="icon-terminal" {...props} />,
  Clock: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
  Settings: (props: Record<string, unknown>) => <span data-testid="icon-settings" {...props} />,
}));

describe("Sidebar", () => {
  it("renders all 5 sidebar buttons", () => {
    const onPanelChange = vi.fn();
    render(<Sidebar activePanel="chat" onPanelChange={onPanelChange} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);

    // Verify each button by its title attribute
    expect(screen.getByTitle("Chat")).toBeDefined();
    expect(screen.getByTitle("Files")).toBeDefined();
    expect(screen.getByTitle("Terminal")).toBeDefined();
    expect(screen.getByTitle("History")).toBeDefined();
    expect(screen.getByTitle("Settings")).toBeDefined();
  });

  it("calls onPanelChange with the correct ID when a button is clicked", () => {
    const onPanelChange = vi.fn();
    render(<Sidebar activePanel="chat" onPanelChange={onPanelChange} />);

    fireEvent.click(screen.getByTitle("Files"));
    expect(onPanelChange).toHaveBeenCalledWith("files");

    fireEvent.click(screen.getByTitle("Terminal"));
    expect(onPanelChange).toHaveBeenCalledWith("terminal");

    fireEvent.click(screen.getByTitle("History"));
    expect(onPanelChange).toHaveBeenCalledWith("history");

    fireEvent.click(screen.getByTitle("Settings"));
    expect(onPanelChange).toHaveBeenCalledWith("settings");

    fireEvent.click(screen.getByTitle("Chat"));
    expect(onPanelChange).toHaveBeenCalledWith("chat");
  });

  it("applies active styling to the active panel button", () => {
    const onPanelChange = vi.fn();
    const { rerender } = render(
      <Sidebar activePanel="files" onPanelChange={onPanelChange} />
    );

    // The "Files" button should have accent color and accent-dim background
    const filesButton = screen.getByTitle("Files");
    expect(filesButton.style.color).toBe("var(--accent)");
    expect(filesButton.style.background).toBe("var(--accent-dim)");

    // The "Chat" button should NOT have active styling
    const chatButton = screen.getByTitle("Chat");
    expect(chatButton.style.color).toBe("var(--text-dim)");
    expect(chatButton.style.background).toBe("transparent");

    // Re-render with a different active panel
    rerender(<Sidebar activePanel="settings" onPanelChange={onPanelChange} />);

    const settingsButton = screen.getByTitle("Settings");
    expect(settingsButton.style.color).toBe("var(--accent)");
    expect(settingsButton.style.background).toBe("var(--accent-dim)");

    // Files should no longer be active
    const filesAgain = screen.getByTitle("Files");
    expect(filesAgain.style.color).toBe("var(--text-dim)");
    expect(filesAgain.style.background).toBe("transparent");
  });
});

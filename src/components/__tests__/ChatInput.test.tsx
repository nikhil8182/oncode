import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInput from "../ChatInput";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  ArrowUp: (props: Record<string, unknown>) => <span data-testid="icon-arrow-up" {...props} />,
  Paperclip: (props: Record<string, unknown>) => <span data-testid="icon-paperclip" {...props} />,
  Square: (props: Record<string, unknown>) => <span data-testid="icon-square" {...props} />,
}));

describe("ChatInput", () => {
  it("disables the textarea when disabled prop is true", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} isStreaming={false} />);

    const textarea = screen.getByPlaceholderText("Ask Oncode anything...");
    expect(textarea).toBeInstanceOf(HTMLTextAreaElement);
    expect((textarea as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("disables the send button when input is empty", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} isStreaming={false} />);

    // The send button should be disabled when there is no text
    const buttons = screen.getAllByRole("button");
    const sendButton = buttons.find((btn) => btn.title === "Send message");
    expect(sendButton).toBeDefined();
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("triggers onSend when Enter key is pressed with text", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} isStreaming={false} />);

    const textarea = screen.getByPlaceholderText("Ask Oncode anything...");

    // Type some text
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    // Press Enter (without Shift)
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("does NOT trigger onSend when Shift+Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} isStreaming={false} />);

    const textarea = screen.getByPlaceholderText("Ask Oncode anything...");

    // Type some text
    fireEvent.change(textarea, { target: { value: "Hello world" } });

    // Press Shift+Enter
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does NOT trigger onSend when Enter is pressed with empty input", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} isStreaming={false} />);

    const textarea = screen.getByPlaceholderText("Ask Oncode anything...");

    // Press Enter with empty input
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does NOT trigger onSend when disabled even with text", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={true} isStreaming={false} />);

    const textarea = screen.getByPlaceholderText("Ask Oncode anything...");

    // Type text (even though disabled, we can set the value via change event simulation)
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });
});

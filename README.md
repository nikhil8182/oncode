# Oncode

AI-powered coding assistant with a browser-based UI, built on Claude.

![Screenshot](screenshot-placeholder.png)

## Quick Start

```bash
# Install dependencies
npm install

# Add your Anthropic API key (or use Claude CLI mode with no key)
cp .env.example .env.local
# Edit .env.local and set ANTHROPIC_API_KEY

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Real-time AI chat with streaming responses
- File reading, writing, and editing via tool use
- Bash command execution within your project
- Glob and grep search across your codebase
- Multi-turn conversation with history
- Project auto-detection from your home directory
- Configurable provider switching at runtime
- WebSocket-based communication for low-latency interaction

## Providers

Oncode supports four ways to connect to Claude:

| Provider | Description | API Key Required |
|---|---|---|
| **Claude Code CLI** | Uses your existing `claude` CLI installation. No API key needed -- the easiest way to get started. | No |
| **Anthropic API Key** | Connect directly with a standard Anthropic API key. | Yes |
| **Claude Max API** | For Claude Max subscribers -- uses your included API credits. | Yes |
| **Session Key** | Uses your claude.ai session cookie as an auth token. Experimental and may break without notice. | Yes |

Switch providers from the settings panel in the UI, or set a default in `.oncode-config.json`.

## Docker Deployment

```bash
# Build and run with Docker Compose
export ANTHROPIC_API_KEY=your-key-here
docker compose up --build

# Or build the image directly
docker build -t oncode .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=your-key-here oncode
```

## Running Tests

```bash
npm test
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, Lucide icons, react-markdown, react-syntax-highlighter
- **Backend**: Custom Node.js server with Socket.io for WebSocket communication
- **AI**: Anthropic Claude API (Sonnet) with agentic tool-use loop
- **Language**: TypeScript throughout
- **Testing**: Vitest with jsdom

## License

MIT

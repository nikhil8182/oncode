import * as fs from "fs";
import * as path from "path";
import type { ProviderType } from "./providers";

// --- Configuration types ---

export interface OncodeConfig {
  provider: ProviderType;
  apiKey?: string;
  sessionKey?: string;
}

const DEFAULT_CONFIG: OncodeConfig = {
  provider: "claude-cli",
};

// Config file lives at the project root
const CONFIG_FILENAME = ".oncode-config.json";

function getConfigPath(): string {
  // Store config relative to the oncode project root (where package.json lives)
  return path.join(__dirname, "..", "..", CONFIG_FILENAME);
}

/**
 * Load the provider configuration from disk.
 * Returns the default config (claude-cli) if no config file exists.
 *
 * Falls back to the ANTHROPIC_API_KEY environment variable (e.g. from .env.local)
 * if no API key is configured in the config file.
 */
export function loadConfig(): OncodeConfig {
  const configPath = getConfigPath();
  let config: OncodeConfig;
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    config = {
      provider: parsed.provider || DEFAULT_CONFIG.provider,
      apiKey: parsed.apiKey,
      sessionKey: parsed.sessionKey,
    };
  } catch {
    // File doesn't exist or is invalid — return defaults
    config = { ...DEFAULT_CONFIG };
  }

  // Fall back to ANTHROPIC_API_KEY env var if no API key is set in the config file
  if (!config.apiKey && process.env.ANTHROPIC_API_KEY) {
    config.apiKey = process.env.ANTHROPIC_API_KEY;
  }

  return config;
}

/**
 * Save the provider configuration to disk.
 */
export function saveConfig(config: OncodeConfig): void {
  const configPath = getConfigPath();
  const data: Record<string, unknown> = {
    provider: config.provider,
  };
  // Only persist keys that are actually set
  if (config.apiKey) data.apiKey = config.apiKey;
  if (config.sessionKey) data.sessionKey = config.sessionKey;

  fs.writeFileSync(configPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/**
 * Mask a sensitive key, showing only the last 4 characters.
 * Returns undefined if the key is not set.
 */
export function maskKey(key?: string): string | undefined {
  if (!key) return undefined;
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

/**
 * Return the config with sensitive keys masked — safe for sending to the client.
 */
export function getMaskedConfig(config: OncodeConfig): {
  provider: ProviderType;
  apiKey?: string;
  sessionKey?: string;
  hasApiKey: boolean;
  hasSessionKey: boolean;
} {
  return {
    provider: config.provider,
    apiKey: maskKey(config.apiKey),
    sessionKey: maskKey(config.sessionKey),
    hasApiKey: !!config.apiKey,
    hasSessionKey: !!config.sessionKey,
  };
}

/**
 * Validate that a provider type string is valid.
 */
export function isValidProvider(provider: string): provider is ProviderType {
  return ["api-key", "max-api", "session-key", "claude-cli"].includes(provider);
}

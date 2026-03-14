import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const CONFIG_FILENAME = ".oncode-config.json";

function getConfigPath(): string {
  return path.join(__dirname, "..", "..", CONFIG_FILENAME);
}

/**
 * Load or generate the auth token.
 *
 * On first run, generates a cryptographically random token,
 * persists it to .oncode-config.json, and returns it.
 * On subsequent runs, reads the saved token from disk.
 */
export function getOrCreateAuthToken(): string {
  const configPath = getConfigPath();

  // Try to load existing config
  let config: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  // Return existing token if present
  if (typeof config.authToken === "string" && config.authToken.length > 0) {
    return config.authToken;
  }

  // Generate a new token: 32 random bytes -> 64-char hex string
  const token = crypto.randomBytes(32).toString("hex");
  config.authToken = token;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  return token;
}

/**
 * Load the auth token from the config file.
 * Returns null if no token has been generated yet.
 */
export function loadAuthToken(): string | null {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (typeof config.authToken === "string" && config.authToken.length > 0) {
      return config.authToken;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return null;
}

/**
 * Validate a token string against the stored auth token.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateToken(providedToken: string): boolean {
  const storedToken = loadAuthToken();
  if (!storedToken) return false;
  if (providedToken.length !== storedToken.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedToken),
      Buffer.from(storedToken)
    );
  } catch {
    return false;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig, getMaskedConfig, isValidProvider } from "@/lib/config";
import { PROVIDER_INFO } from "@/lib/providers";
import type { ProviderType } from "@/lib/providers";

/**
 * GET /api/config
 * Returns the current provider configuration with sensitive keys masked.
 */
export async function GET() {
  try {
    const config = loadConfig();
    const masked = getMaskedConfig(config);
    return NextResponse.json({
      ...masked,
      providers: PROVIDER_INFO,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/config
 * Save a complete new provider configuration.
 * Body: { provider: ProviderType, apiKey?: string, sessionKey?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, apiKey, sessionKey } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Missing required field: provider" },
        { status: 400 }
      );
    }

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        {
          error: `Invalid provider: "${provider}". Must be one of: api-key, max-api, session-key, claude-cli`,
        },
        { status: 400 }
      );
    }

    // Validate that key-based providers have a key
    const info = PROVIDER_INFO[provider as ProviderType];
    if (info.requiresKey) {
      if (provider === "session-key" && !sessionKey) {
        return NextResponse.json(
          { error: "Session key provider requires a sessionKey" },
          { status: 400 }
        );
      }
      if ((provider === "api-key" || provider === "max-api") && !apiKey) {
        // Allow it if env var is set
        if (!process.env.ANTHROPIC_API_KEY) {
          return NextResponse.json(
            {
              error:
                "API key provider requires an apiKey (or set the ANTHROPIC_API_KEY environment variable)",
            },
            { status: 400 }
          );
        }
      }
    }

    const config = {
      provider: provider as ProviderType,
      apiKey: apiKey || undefined,
      sessionKey: sessionKey || undefined,
    };

    saveConfig(config);

    const masked = getMaskedConfig(config);
    return NextResponse.json({
      success: true,
      ...masked,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/config
 * Update specific fields in the configuration without replacing the whole thing.
 * Body: { provider?: ProviderType, apiKey?: string, sessionKey?: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const existing = loadConfig();

    if (body.provider !== undefined) {
      if (!isValidProvider(body.provider)) {
        return NextResponse.json(
          {
            error: `Invalid provider: "${body.provider}". Must be one of: api-key, max-api, session-key, claude-cli`,
          },
          { status: 400 }
        );
      }
      existing.provider = body.provider;
    }

    if (body.apiKey !== undefined) {
      existing.apiKey = body.apiKey || undefined;
    }

    if (body.sessionKey !== undefined) {
      existing.sessionKey = body.sessionKey || undefined;
    }

    saveConfig(existing);

    const masked = getMaskedConfig(existing);
    return NextResponse.json({
      success: true,
      ...masked,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update config";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

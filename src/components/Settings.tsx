"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Terminal,
  Key,
  Zap,
  FlaskConical,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { withAuthToken, authHeaders } from "@/lib/client-auth";

type ProviderId = "claude-cli" | "api-key" | "max-api" | "session-key";

interface ProviderCard {
  id: ProviderId;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: "recommended" | "experimental";
  description: string;
  field?: "apiKey" | "sessionKey";
  fieldLabel?: string;
  linkText?: string;
  linkHref?: string;
  warningText?: string;
}

const providers: ProviderCard[] = [
  {
    id: "claude-cli",
    icon: <Terminal size={20} />,
    label: "Claude Code CLI",
    badge: "Recommended \u2014 No setup needed",
    badgeVariant: "recommended",
    description:
      "Uses your existing Claude Code subscription. Requires Claude Code CLI installed.",
  },
  {
    id: "api-key",
    icon: <Key size={20} />,
    label: "API Key",
    description: "Direct Anthropic API access. Pay per token.",
    field: "apiKey",
    fieldLabel: "API Key",
    linkText: "Get your key at console.anthropic.com",
    linkHref: "https://console.anthropic.com",
  },
  {
    id: "max-api",
    icon: <Zap size={20} />,
    label: "Claude Max",
    description: "Included API credits with Max plan ($100/mo).",
    field: "apiKey",
    fieldLabel: "API Key",
    linkText: "Check your plan at claude.ai/settings",
    linkHref: "https://claude.ai/settings",
  },
  {
    id: "session-key",
    icon: <FlaskConical size={20} />,
    label: "Session Key",
    badge: "Experimental",
    badgeVariant: "experimental",
    description: "Use your claude.ai session cookie. May break unexpectedly.",
    field: "sessionKey",
    fieldLabel: "Session Key",
    warningText: "Extract from browser cookies on claude.ai",
  },
];

export default function Settings() {
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("claude-cli");
  const [apiKey, setApiKey] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSessionKey, setShowSessionKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [cliStatus, setCliStatus] = useState<{
    available: boolean;
    version?: string;
    loading: boolean;
  }>({ available: false, loading: true });
  const [loadedMasked, setLoadedMasked] = useState<{
    apiKey?: string;
    sessionKey?: string;
  }>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load current config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(withAuthToken("/api/config"));
        if (res.ok) {
          const data = await res.json();
          setSelectedProvider(data.provider || "claude-cli");
          if (data.apiKey) {
            setLoadedMasked((prev) => ({ ...prev, apiKey: data.apiKey }));
          }
          if (data.sessionKey) {
            setLoadedMasked((prev) => ({ ...prev, sessionKey: data.sessionKey }));
          }
        }
      } catch {
        // Failed to load config, use defaults
      }
    }
    loadConfig();
  }, []);

  // Check CLI availability
  useEffect(() => {
    async function checkCli() {
      try {
        const res = await fetch(withAuthToken("/api/config/check-cli"));
        if (res.ok) {
          const data = await res.json();
          setCliStatus({ available: data.available, version: data.version, loading: false });
        } else {
          setCliStatus({ available: false, loading: false });
        }
      } catch {
        setCliStatus({ available: false, loading: false });
      }
    }
    checkCli();
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatusMsg(null);

    try {
      const body: Record<string, string> = { provider: selectedProvider };

      // Only send key fields if the user typed a new value
      if (apiKey) body.apiKey = apiKey;
      if (sessionKey) body.sessionKey = sessionKey;

      const res = await fetch(withAuthToken("/api/config"), {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMsg({ type: "success", text: "Settings saved successfully" });
        // Update masked displays
        if (data.apiKey) {
          setLoadedMasked((prev) => ({ ...prev, apiKey: data.apiKey }));
        }
        if (data.sessionKey) {
          setLoadedMasked((prev) => ({ ...prev, sessionKey: data.sessionKey }));
        }
        // Clear raw inputs since they're now saved
        setApiKey("");
        setSessionKey("");
      } else {
        const data = await res.json();
        setStatusMsg({ type: "error", text: data.error || "Failed to save" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Network error. Could not save settings." });
    } finally {
      setSaving(false);
    }
  }, [selectedProvider, apiKey, sessionKey]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const body: Record<string, string> = { provider: selectedProvider };
      if (apiKey) body.apiKey = apiKey;
      if (sessionKey) body.sessionKey = sessionKey;

      const res = await fetch(withAuthToken("/api/config/test"), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          type: "success",
          text: data.model
            ? `Connected (${data.model})`
            : data.message || "Connection successful",
        });
      } else {
        setTestResult({
          type: "error",
          text: data.message || "Connection failed",
        });
      }
    } catch {
      setTestResult({ type: "error", text: "Network error. Could not test connection." });
    } finally {
      setTesting(false);
    }
  }, [selectedProvider, apiKey, sessionKey]);

  const getFieldValue = (field: "apiKey" | "sessionKey"): string => {
    if (field === "apiKey") return apiKey;
    return sessionKey;
  };

  const getFieldSetter = (field: "apiKey" | "sessionKey") => {
    if (field === "apiKey") return setApiKey;
    return setSessionKey;
  };

  const getShowState = (field: "apiKey" | "sessionKey"): boolean => {
    if (field === "apiKey") return showApiKey;
    return showSessionKey;
  };

  const getShowToggle = (field: "apiKey" | "sessionKey") => {
    if (field === "apiKey") return () => setShowApiKey((v) => !v);
    return () => setShowSessionKey((v) => !v);
  };

  const getMasked = (field: "apiKey" | "sessionKey"): string | undefined => {
    return loadedMasked[field];
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div className="panel-header" style={{ justifyContent: "space-between" }}>
        <span>Settings</span>
      </div>

      {/* Scrollable content */}
      <div
        className="panel-content"
        style={{ padding: "20px 24px", maxWidth: 640, width: "100%", margin: "0 auto" }}
      >
        {/* Section title */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: 4,
          }}
        >
          Claude Provider
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          Choose how Oncode connects to Claude
        </div>

        {/* Provider cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {providers.map((provider) => {
            const isSelected = selectedProvider === provider.id;

            return (
              <div
                key={provider.id}
                onClick={() => setSelectedProvider(provider.id)}
                style={{
                  background: isSelected ? "var(--accent-dim)" : "var(--surface)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--border-alt)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--border)";
                  }
                }}
              >
                {/* Card header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  {/* Radio indicator */}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: `2px solid ${isSelected ? "var(--accent)" : "var(--text-dim)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "border-color 0.15s",
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--accent)",
                        }}
                      />
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    style={{
                      color: isSelected ? "var(--accent)" : "var(--text-muted)",
                      display: "flex",
                      alignItems: "center",
                      flexShrink: 0,
                      transition: "color 0.15s",
                    }}
                  >
                    {provider.icon}
                  </div>

                  {/* Label */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isSelected ? "var(--text)" : "var(--text-muted)",
                      transition: "color 0.15s",
                    }}
                  >
                    {provider.label}
                  </span>

                  {/* Badge */}
                  {provider.badge && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background:
                          provider.badgeVariant === "recommended"
                            ? "var(--accent-dim)"
                            : "rgba(234, 179, 8, 0.12)",
                        color:
                          provider.badgeVariant === "recommended"
                            ? "var(--accent)"
                            : "#eab308",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {provider.badge}
                    </span>
                  )}

                  {/* CLI status indicator (only for claude-cli provider) */}
                  {provider.id === "claude-cli" && (
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                      }}
                    >
                      {cliStatus.loading ? (
                        <Loader2
                          size={12}
                          style={{ color: "var(--text-dim)", animation: "spin 1s linear infinite" }}
                        />
                      ) : cliStatus.available ? (
                        <>
                          <Check size={12} style={{ color: "var(--accent)" }} />
                          <span style={{ color: "var(--accent)" }}>
                            {cliStatus.version ? cliStatus.version : "Available"}
                          </span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={12} style={{ color: "var(--danger)" }} />
                          <span style={{ color: "var(--danger)" }}>Not found</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-dim)",
                    marginLeft: 26,
                    lineHeight: 1.5,
                  }}
                >
                  {provider.description}
                </div>

                {/* Expandable config field */}
                {isSelected && provider.field && (
                  <div style={{ marginTop: 12, marginLeft: 26 }}>
                    {/* Show masked key if one is saved */}
                    {getMasked(provider.field) && !getFieldValue(provider.field) && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-dim)",
                          marginBottom: 6,
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        Current: {getMasked(provider.field)}
                      </div>
                    )}

                    {/* Input field */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "var(--surface-alt)",
                        border: "1px solid var(--border-alt)",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                      }}
                    >
                      <input
                        type={getShowState(provider.field) ? "text" : "password"}
                        value={getFieldValue(provider.field)}
                        onChange={(e) => getFieldSetter(provider.field!)(e.target.value)}
                        placeholder={`Enter ${provider.fieldLabel || provider.field}...`}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          background: "transparent",
                          color: "var(--text)",
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          getShowToggle(provider.field!)();
                        }}
                        style={{
                          width: 36,
                          height: 36,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-dim)",
                          flexShrink: 0,
                          transition: "color 0.15s",
                        }}
                        title={getShowState(provider.field) ? "Hide" : "Show"}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--text-muted)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--text-dim)")
                        }
                      >
                        {getShowState(provider.field) ? (
                          <EyeOff size={14} />
                        ) : (
                          <Eye size={14} />
                        )}
                      </button>
                    </div>

                    {/* Link or warning */}
                    {provider.linkText && provider.linkHref && (
                      <a
                        href={provider.linkHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: "var(--accent)",
                          marginTop: 8,
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.textDecoration = "underline")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.textDecoration = "none")
                        }
                      >
                        <ExternalLink size={11} />
                        {provider.linkText}
                      </a>
                    )}

                    {provider.warningText && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 11,
                          color: "#eab308",
                          marginTop: 8,
                        }}
                      >
                        <AlertTriangle size={12} />
                        {provider.warningText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save & Test buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-md)",
              background: saving ? "var(--accent-hover)" : "var(--accent)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              transition: "background 0.15s",
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.background = "var(--accent)";
            }}
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTest();
            }}
            disabled={testing}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--radius-md)",
              background: testing ? "var(--surface-alt)" : "var(--surface)",
              color: "var(--text-muted)",
              border: "1px solid var(--border-alt)",
              cursor: testing ? "not-allowed" : "pointer",
              transition: "background 0.15s, border-color 0.15s",
              opacity: testing ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (!testing) {
                e.currentTarget.style.background = "var(--surface-alt)";
                e.currentTarget.style.borderColor = "var(--text-dim)";
              }
            }}
            onMouseLeave={(e) => {
              if (!testing) {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border-alt)";
              }
            }}
          >
            {testing ? (
              <>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div
            style={{
              marginTop: 12,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              background:
                statusMsg.type === "success"
                  ? "var(--accent-dim)"
                  : "rgba(239, 68, 68, 0.12)",
              color:
                statusMsg.type === "success" ? "var(--accent)" : "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {statusMsg.type === "success" ? (
              <Check size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {statusMsg.text}
          </div>
        )}

        {/* Test result message */}
        {testResult && (
          <div
            style={{
              marginTop: statusMsg ? 8 : 12,
              padding: "8px 12px",
              borderRadius: "var(--radius-md)",
              fontSize: 12,
              background:
                testResult.type === "success"
                  ? "var(--accent-dim)"
                  : "rgba(239, 68, 68, 0.12)",
              color:
                testResult.type === "success" ? "var(--accent)" : "var(--danger)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {testResult.type === "success" ? (
              <Check size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {testResult.text}
          </div>
        )}

        {/* Spacer at bottom */}
        <div style={{ height: 40 }} />
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

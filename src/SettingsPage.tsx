import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import "./Settings.css";

// Mirror the Rust TtsConfig structure
interface TtsConfig {
  active_engine: "system" | "piper" | "cloud";
  system: { voice: string | null };
  piper: { model_path: string | null; piper_binary: string | null };
  cloud: {
    provider: "openai" | "azure" | "google";
    api_key: string | null;
    voice: string | null;
    endpoint: string | null;
  };
  default_rate: number;
  default_pitch: number;
  default_volume: number;
}

type Tab = "general" | "piper" | "cloud" | "about";

export default function SettingsPage() {
  const [config, setConfig] = useState<TtsConfig | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [engines, setEngines] = useState<string[]>([]);

  // Load config on mount
  useEffect(() => {
    invoke<TtsConfig>("get_tts_config").then(setConfig).catch(console.error);
    invoke<string[]>("get_available_engines").then(setEngines).catch(console.error);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await invoke("update_tts_config", { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
    setSaving(false);
  };

  const update = <K extends keyof TtsConfig>(key: K, value: TtsConfig[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  if (!config) {
    return <div className="settings-root"><p>Loading...</p></div>;
  }

  return (
    <div className="settings-root">
      <h1 className="settings-title">🐱 Neko TTS Settings</h1>

      {/* Tab bar */}
      <div className="tab-bar">
        {(["general", "piper", "cloud", "about"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "general" && "⚙️ General"}
            {tab === "piper" && "🔧 Piper"}
            {tab === "cloud" && "☁️ Cloud"}
            {tab === "about" && "ℹ️ About"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {activeTab === "general" && (
          <GeneralTab config={config} update={update} engines={engines} />
        )}
        {activeTab === "piper" && (
          <PiperTab config={config} update={update} />
        )}
        {activeTab === "cloud" && (
          <CloudTab config={config} update={update} />
        )}
        {activeTab === "about" && <AboutTab />}
      </div>

      {/* Save button */}
      {activeTab !== "about" && (
        <div className="save-bar">
          <button className="save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving..." : saved ? "✅ Saved!" : "💾 Save Settings"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── General Tab ──────────────────────────────────────────────────

function GeneralTab({
  config,
  update,
  engines,
}: {
  config: TtsConfig;
  update: <K extends keyof TtsConfig>(key: K, value: TtsConfig[K]) => void;
  engines: string[];
}) {
  return (
    <div className="tab-panel">
      <div className="field">
        <label>Active Engine</label>
        <select
          value={config.active_engine}
          onChange={(e) =>
            update("active_engine", e.target.value as TtsConfig["active_engine"])
          }
        >
          <option value="system">System TTS</option>
          <option value="piper">Piper (Offline)</option>
          <option value="cloud">Cloud API</option>
        </select>
        <span className="hint">
          Available: {engines.length > 0 ? engines.join(", ") : "detecting..."}
        </span>
      </div>

      <div className="field">
        <label>Speech Rate</label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={config.default_rate}
          onChange={(e) => update("default_rate", parseFloat(e.target.value))}
        />
        <span className="value">{config.default_rate.toFixed(1)}x</span>
      </div>

      <div className="field">
        <label>Pitch</label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={config.default_pitch}
          onChange={(e) => update("default_pitch", parseFloat(e.target.value))}
        />
        <span className="value">{config.default_pitch.toFixed(1)}x</span>
      </div>

      <div className="field">
        <label>Volume</label>
        <input
          type="range"
          min="0.0"
          max="1.0"
          step="0.05"
          value={config.default_volume}
          onChange={(e) => update("default_volume", parseFloat(e.target.value))}
        />
        <span className="value">{Math.round(config.default_volume * 100)}%</span>
      </div>

      <div className="field">
        <label>System Voice</label>
        <input
          type="text"
          placeholder="Default system voice"
          value={config.system.voice ?? ""}
          onChange={(e) =>
            update("system", {
              ...config.system,
              voice: e.target.value || null,
            })
          }
        />
        <span className="hint">Leave empty for system default</span>
      </div>
    </div>
  );
}

// ─── Piper Tab ────────────────────────────────────────────────────

function PiperTab({
  config,
  update,
}: {
  config: TtsConfig;
  update: <K extends keyof TtsConfig>(key: K, value: TtsConfig[K]) => void;
}) {
  return (
    <div className="tab-panel">
      <div className="field">
        <label>Piper Binary Path</label>
        <input
          type="text"
          placeholder="/usr/bin/piper or leave empty for PATH"
          value={config.piper.piper_binary ?? ""}
          onChange={(e) =>
            update("piper", {
              ...config.piper,
              piper_binary: e.target.value || null,
            })
          }
        />
        <span className="hint">
          Path to the piper executable. Leave empty to use system PATH.
        </span>
      </div>

      <div className="field">
        <label>Voice Model Path (.onnx)</label>
        <input
          type="text"
          placeholder="/path/to/model.onnx"
          value={config.piper.model_path ?? ""}
          onChange={(e) =>
            update("piper", {
              ...config.piper,
              model_path: e.target.value || null,
            })
          }
        />
        <span className="hint">
          Download models from{" "}
          <a
            href="https://github.com/rhasspy/piper/releases"
            target="_blank"
            rel="noreferrer"
          >
            Piper releases
          </a>
        </span>
      </div>
    </div>
  );
}

// ─── Cloud Tab ────────────────────────────────────────────────────

function CloudTab({
  config,
  update,
}: {
  config: TtsConfig;
  update: <K extends keyof TtsConfig>(key: K, value: TtsConfig[K]) => void;
}) {
  return (
    <div className="tab-panel">
      <div className="field">
        <label>Provider</label>
        <select
          value={config.cloud.provider}
          onChange={(e) =>
            update("cloud", {
              ...config.cloud,
              provider: e.target.value as TtsConfig["cloud"]["provider"],
            })
          }
        >
          <option value="openai">OpenAI</option>
          <option value="azure">Azure</option>
          <option value="google">Google</option>
        </select>
      </div>

      <div className="field">
        <label>API Key</label>
        <input
          type="password"
          placeholder="Enter your API key"
          value={config.cloud.api_key ?? ""}
          onChange={(e) =>
            update("cloud", {
              ...config.cloud,
              api_key: e.target.value || null,
            })
          }
        />
        <span className="hint">Your API key is stored locally and never shared.</span>
      </div>

      <div className="field">
        <label>Voice</label>
        <input
          type="text"
          placeholder={
            config.cloud.provider === "openai"
              ? "alloy, echo, fable, onyx, nova, shimmer"
              : "Voice ID"
          }
          value={config.cloud.voice ?? ""}
          onChange={(e) =>
            update("cloud", {
              ...config.cloud,
              voice: e.target.value || null,
            })
          }
        />
      </div>

      <div className="field">
        <label>Custom Endpoint (optional)</label>
        <input
          type="text"
          placeholder="https://api.openai.com/v1"
          value={config.cloud.endpoint ?? ""}
          onChange={(e) =>
            update("cloud", {
              ...config.cloud,
              endpoint: e.target.value || null,
            })
          }
        />
        <span className="hint">
          Override the default API endpoint (useful for proxies or Azure).
        </span>
      </div>
    </div>
  );
}

// ─── About Tab ────────────────────────────────────────────────────

function AboutTab() {
  return (
    <div className="tab-panel about-panel">
      <div className="about-logo">🐱</div>
      <h2>Neko TTS</h2>
      <p className="version">Version 0.1.0</p>
      <p>A cute desktop pet that reads text aloud.</p>
      <div className="shortcuts-list">
        <h3>Keyboard Shortcuts</h3>
        <div className="shortcut-row">
          <kbd>Ctrl+Shift+S</kbd>
          <span>Toggle quick input</span>
        </div>
        <div className="shortcut-row">
          <kbd>Ctrl+Shift+R</kbd>
          <span>Read clipboard aloud</span>
        </div>
      </div>
      <p className="credits">
        Built with Tauri + React + Rust 🦀
      </p>
    </div>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import { appWindow } from "@tauri-apps/api/window";
import App from "./App";
import SettingsPage from "./SettingsPage";
import StudioApp from "./StudioApp";

// Determine which component to render based on the Tauri window label
const label = appWindow.label;

function RootApp() {
  if (label === "settings") return <SettingsPage />;
  if (label === "studio") return <StudioApp />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);

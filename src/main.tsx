import React from "react";
import ReactDOM from "react-dom/client";
import { appWindow } from "@tauri-apps/api/window";
import App from "./App";
import SettingsPage from "./SettingsPage";

// Determine which component to render based on the Tauri window label
const label = appWindow.label;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {label === "settings" ? <SettingsPage /> : <App />}
  </React.StrictMode>,
);

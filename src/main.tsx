import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable right-click context menu to enforce native desktop feeling
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Disable default browser keyboard combinations (zoom, reload, inspector)
document.addEventListener("keydown", (e) => {
  if (
    (e.ctrlKey && e.key === "r") || 
    e.key === "F5" || 
    (e.ctrlKey && e.shiftKey && e.key === "I") ||
    (e.ctrlKey && e.key === "=") ||
    (e.ctrlKey && e.key === "-")
  ) {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

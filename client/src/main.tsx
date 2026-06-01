import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { SkinProvider } from "./skins/SkinContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SkinProvider>
      <App />
    </SkinProvider>
  </StrictMode>
);

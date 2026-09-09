import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTouchScrollFix } from "./lib/touch-scroll-lock-fix";

initTouchScrollFix();

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setBaseUrl(
  localStorage.getItem("tayyibati_api_url") || "https://api.tayyibati.xyz"
);

setAuthTokenGetter(() => localStorage.getItem("tayyibati_admin_token"));

createRoot(document.getElementById("root")!).render(<App />);
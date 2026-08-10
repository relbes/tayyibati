import { createRoot } from "react-dom/client";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";
import { getApiBaseUrl } from "@/lib/api";

const apiUrl = getApiBaseUrl();
if (import.meta.env.DEV) {
  console.log("Admin API:", apiUrl);
}

setBaseUrl(apiUrl);

setAuthTokenGetter(() => localStorage.getItem("tayyibati_admin_token"));

createRoot(document.getElementById("root")!).render(<App />);
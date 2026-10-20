import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setExtraHeadersGetter } from "@workspace/api-client-react";

import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";

import "./index.css";

const GUEST_KEY = "skilytics.guest";
function guestToken(): string {
  let tok = localStorage.getItem(GUEST_KEY);
  if (!tok || tok.length < 32) {
    tok = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    localStorage.setItem(GUEST_KEY, tok);
  }
  return tok;
}
const guest = guestToken();
setExtraHeadersGetter(() => ({ "x-guest-token": guest }));
setAuthTokenGetter(() => localStorage.getItem("skilytics.token"));

createRoot(document.getElementById("root")!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

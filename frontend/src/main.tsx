import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import Root from "./Root";
import "./index.css";

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <StrictMode>
    <HashRouter basename={"/"}>
      <Root />
    </HashRouter>
  </StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider, BaseStyles, theme } from "@primer/react";
import App from "./App";
import "./styles/app.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <BaseStyles>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </React.StrictMode>
);

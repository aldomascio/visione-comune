"use client";

import { useEffect } from "react";

const ACCESSIYES_SCRIPT_ID = "accessiyes-widget-script";
const ACCESSIYES_SCRIPT_URL = "https://cdn-cookieyes.com/widgets/accessibility.js";

function darkenHexColor(color: string, amount = 0.18) {
  const normalizedColor = color.trim().replace("#", "");

  if (!/^[0-9a-f]{6}$/i.test(normalizedColor)) {
    return color.trim();
  }

  const channels = normalizedColor.match(/.{2}/g);

  if (!channels) {
    return color.trim();
  }

  return `#${channels
    .map((channel) => Math.round(Number.parseInt(channel, 16) * (1 - amount)).toString(16).padStart(2, "0"))
    .join("")}`;
}

type AccessiYesWindow = Window & {
  _cyA11yConfig?: {
    status: { desktop: boolean; mobile: boolean };
    iconId: "default" | "accessibility" | "assist" | "wheel";
    primaryColor: string;
    iconSize: number;
    label: string;
    position: { desktop: "bottom-left"; mobile: "bottom-left" };
    language: { default: string; selected: string[] };
    keyboard: { enabled: boolean; shortcut: string };
    modules: { statement: { enabled: boolean; url: string } };
  };
};

export function AccessiYesWidget() {
  useEffect(() => {
    if (document.getElementById(ACCESSIYES_SCRIPT_ID)) {
      return;
    }

    const accessiYesWindow = window as AccessiYesWindow;
    const themePrimaryColor = getComputedStyle(document.documentElement).getPropertyValue("--primary");

    accessiYesWindow._cyA11yConfig = {
      status: { desktop: true, mobile: true },
      iconId: "accessibility",
      primaryColor: darkenHexColor(themePrimaryColor),
      iconSize: 48,
      label: "Apri gli strumenti di accessibilità",
      position: { desktop: "bottom-left", mobile: "bottom-left" },
      language: { default: "it", selected: [] },
      keyboard: { enabled: true, shortcut: "alt+a" },
      modules: { statement: { enabled: false, url: "" } }
    };

    const script = document.createElement("script");
    script.id = ACCESSIYES_SCRIPT_ID;
    script.src = ACCESSIYES_SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return null;
}

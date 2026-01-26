import { Hono } from "hono"
import { renderToString } from "react-dom/server"
import ChrryDotDev from "../../components/ChrryDotDev"
import React from "react"

export const landing = new Hono()

landing.get("/", (c) => {
  const html = renderToString(React.createElement(ChrryDotDev))

  return c.html(`<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chrry - AI-Powered Development Platform</title>
    <style>
      @keyframes slideLeft {
        0% {
          opacity: 0;
          transform: translate(-1.25rem);
        }
      
        to {
          opacity: 1;
          transform: translate(0);
        }
      }
      
      @keyframes slideRight {
        0% {
          opacity: 0;
          transform: translate(1.25rem);
        }
      
        to {
          opacity: 1;
          transform: translate(0);
        }
      }
      
      @keyframes slideUp {
        0% {
          opacity: 0;
          transform: translateY(1.25rem);
        }
      
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes blink {
        0%,
        to {
          opacity: 1;
        }
      
        50% {
          opacity: 0;
        }
      }
      
      @keyframes pulse {
        0% {
          opacity: 0.7;
          transform: scale(0.9);
        }
      
        50% {
          opacity: 1;
          transform: scale(1.1);
        }
      
        to {
          opacity: 0.7;
          transform: scale(0.9);
        }
      }
      
      @keyframes float {
        0%,
        to {
          transform: translateY(0);
        }
      
        50% {
          transform: translateY(-5px);
        }
      }
      
      @keyframes wiggle {
        0%,
        to {
          transform: rotate(-5deg);
        }
      
        50% {
          transform: rotate(5deg);
        }
      }
      
      :root {
        --overlay: #0000001a;
        --foreground: #000;
        --background: #fff;
        --red-50: #fef2f2;
        --red-100: #fee2e2;
        --red-200: #fecaca;
        --red-300: #fca5a5;
        --red-400: #f87171;
        --red-500: #ef4444;
        --red-600: #dc2626;
        --red-700: #b91c1c;
        --red-800: #991b1b;
        --red-900: #7f1d1d;
        --orange-50: #fff7ed;
        --orange-100: #ffedd5;
        --orange-200: #fed7aa;
        --orange-300: #fdba74;
        --orange-400: #fb923c;
        --orange-500: #f97316;
        --orange-600: #ea580c;
        --orange-700: #c2410c;
        --orange-800: #9a3412;
        --orange-900: #7c2d12;
        --green-50: #f0fdf4;
        --green-100: #dcfce7;
        --green-200: #bbf7d0;
        --green-300: #86efac;
        --green-400: #4ade80;
        --green-500: #22c55e;
        --green-600: #16a34a;
        --green-700: #15803d;
        --green-800: #166534;
        --green-900: #14532d;
        --blue-50: #eff6ff;
        --blue-100: #dbeafe;
        --blue-200: #bfdbfe;
        --blue-300: #93c5fd;
        --blue-400: #60a5fa;
        --blue-500: #3b82f6;
        --blue-600: #2563eb;
        --blue-700: #1d4ed8;
        --blue-800: #1e40af;
        --blue-900: #1e3a8a;
        --violet-50: #f5f3ff;
        --violet-100: #ede9fe;
        --violet-200: #ddd6fe;
        --violet-300: #c4b5fd;
        --violet-400: #a78bfa;
        --violet-500: #8b5cf6;
        --violet-600: #7c3aed;
        --violet-700: #6d28d9;
        --violet-800: #5b21b6;
        --violet-900: #4c1d95;
        --purple-50: #faf5ff;
        --purple-100: #f3e8ff;
        --purple-200: #e9d5ff;
        --purple-300: #d8b4fe;
        --purple-400: #c084fc;
        --purple-500: #a855f7;
        --purple-600: #9333ea;
        --purple-700: #7e22ce;
        --purple-800: #6b21a8;
        --purple-900: #581c87;
        --accent-0: #ef4444;
        --accent-1: #f97316;
        --accent-2: #84cc16;
        --accent-3: #22c55e;
        --accent-4: #10b981;
        --accent-5: #06b6d4;
        --accent-6: #3b82f6;
        --accent-7: #a855f7;
        --accent-8: #ec4899;
        --shadow-glow: 0 0 0.9375rem #33cc334d;
        --shade-1-transparent: x;
        --shade-2-transparent: #e5e7ebcc;
        --shade-3-transparent: #9ca3afcc;
        --background-transparent: #fffc;
        --shade-1: #f9fafb;
        --shade-2: #e5e7eb;
        --shade-3: #9ca3af;
        --shade-4: #6b7280;
        --shade-5: #4b5563;
        --shade-6: #374151;
        --shade-7: #1f2937;
        --shade-8: #111827;
        --number-flow-char-height: 1.875rem;
        --selection: var(--accent-2);
        --link-color: var(--accent-6);
        --secondary-light: var(--shade-3);
        --secondary: var(--shade-5);
        --secondary-dark: var(--shade-7);
        --shadow: 0 0.1875rem 1.5625rem #00000029;
        --portal-opacity: 0.25;
        --border-transition: border-color 0.4s ease-in-out;
        --radius: 1.25rem;
        --breakpoint-mobile: $breakpoint-mobile;
        --breakpoint-tablet: $breakpoint-table;
        --breakpoint-desktop: $breakpoint-desktop;
        --font-sans:
          -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
          "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
        --font-mono:
          Menlo, "Roboto Mono", Monaco, Lucida Console, Liberation Mono,
          DejaVu Sans Mono, Bitstream Vera Sans Mono, Courier New, monospace;
      }
      
      @media print {
        @page {
          margin: 0.625rem;
          size: auto;
        }
      
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      
      *,
      :before,
      :after {
        box-sizing: border-box;
      }
      
      html[style*="color-scheme: dark"],
      html.dark {
        --overlay: #ffffff1a;
        --foreground: #fff;
        --background: #000;
        --shade-8: #f9fafb;
        --shade-7: #e5e7eb;
        --shade-6: #9ca3af;
        --shade-5: #6b7280;
        --shade-4: #4b5563;
        --shade-3: #374151;
        --shade-2: #1f2937;
        --shade-1: #111827;
        --shade-1-transparent: #111827cc;
        --shade-2-transparent: #1f2937cc;
        --shade-3-transparent: #374151cc;
        --background-transparent: #000c;
        --selection: var(--accent-7);
        --shadow-glow: 0 0 1.875rem #33cc334d;
      }
      
      hr {
        border: 0.0625rem dashed var(--shade-2);
      }
      
      p {
        margin: 0.15625rem 0;
      }
      
      html,
      body {
        background-color: var(--background);
        margin: 0;
        padding: 0;
      }
      
      html.red,
      body.red {
        --accent-0: var(--red-500);
        --accent-1: var(--red-400);
        --accent-2: var(--red-300);
        --accent-3: var(--red-200);
      }
      
      html.orange,
      body.orange {
        --accent-0: var(--orange-500);
        --accent-1: var(--orange-400);
        --accent-2: var(--orange-300);
        --accent-3: var(--orange-200);
      }
      
      html.blue,
      body.blue {
        --accent-0: var(--blue-500);
        --accent-1: var(--blue-400);
        --accent-2: var(--blue-300);
        --accent-3: var(--blue-200);
        --accent-6: var(--blue-600);
      }
      
      html.green,
      body.green {
        --accent-0: var(--green-500);
        --accent-1: var(--green-400);
        --accent-2: var(--green-300);
        --accent-3: var(--green-200);
      }
      
      html.violet,
      body.violet {
        --accent-0: var(--violet-500);
        --accent-1: var(--violet-400);
        --accent-2: var(--violet-300);
        --accent-3: var(--violet-200);
        --accent-7: var(--violet-600);
      }
      
      html.purple,
      body.purple {
        --accent-0: var(--purple-500);
        --accent-1: var(--purple-400);
        --accent-2: var(--purple-300);
        --accent-3: var(--purple-200);
        --accent-8: var(--purple-600);
      }
      
      body {
        color: var(--foreground);
        font-family: var(--font-sans);
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
        height: 100dvh;
        font-size: 1rem;
        line-height: 1.25;
        overflow-y: scroll;
      }
      
      a,
      .link {
        color: var(--accent-6);
        cursor: pointer;
        box-shadow: none;
        background-color: #0000;
        align-items: center;
        gap: 0.3125rem;
        margin: 0;
        padding: 0;
        text-decoration: none;
        display: inline-flex;
      }
      
      a:hover,
      .link:hover,
      a:disabled,
      .link:disabled {
        color: var(--accent-5);
        background-color: #0000;
        text-decoration: none;
      }
      
      a:active,
      .link:active {
        transform: translateY(0.075rem);
      }
      
      pre,
      code {
        font-family: var(--font-mono);
        white-space: pre-wrap !important;
        word-break: break-all !important;
      }
      
      .button,
      button {
        background-color: var(--link-color);
        color: #fff;
        border-radius: var(--radius);
        cursor: pointer;
        box-shadow: var(--shadow);
        border: none;
        align-items: center;
        gap: 0.3125rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        line-height: 1.15;
        display: inline-flex;
      }
      
      .button.small,
      button.small {
        padding: 0.35rem 0.55rem;
      }
      
      .button.xSmall,
      button.xSmall {
        padding: 0.25rem 0.45rem;
      }
      
   
      
      button.transparent,
      .button.transparent {
        background-color: var(--background);
        color: var(--foreground);
        border: 0.0625rem solid var(--shade-2);
        box-shadow: none;
      }
      
      button.transparent:hover,
      .button.transparent:hover {
        background-color: var(--shade-1) !important;
        color: var(--foreground) !important;
      }
      
      button.inverted,
      .button.inverted {
        background-color: var(--foreground);
        color: var(--background);
        border: 0.0625rem solid var(--shade-2);
        box-shadow: none;
      }
      
      button.inverted:hover,
      .button.inverted:hover {
        background-color: var(--shade-7) !important;
        color: var(--background) !important;
      }
      
      button[type="submit"] {
        font-weight: 400;
      }
      
      .button:hover,
      button:hover {
        background-color: var(--accent-5) !important;
        color: #fff !important;
      }
      
      .button:disabled,
      button:disabled {
        cursor: default;
        background-color: var(--background);
        color: var(--foreground);
      }
      
      .button:active,
      button:active {
        transform: translateY(0.075rem) !important;
      }
      
      select {
        appearance: none;
        border: 1px dashed var(--accent-1);
        border-radius: var(--radius);
        background-color: var(--background);
        color: var(--foreground);
        transition: var(--border-transition);
        cursor: pointer;
        padding: 0.5rem 2.5rem 0.5rem 0.5rem;
      }
      
      select:focus,
      select:hover,
      select:active {
        border-color: var(--link-color);
        outline: var(--link-color);
      }
      
      .slideUp {
        animation: 0.2s slideUp;
      }
      
      .row {
        flex-wrap: wrap;
        gap: 0.3125rem;
        flex-direction: row !important;
        align-items: center !important;
        display: flex !important;
      }
      
      .ghost:hover {
        color: var(--foreground) !important;
        background-color: #0000 !important;
      }
      
      .column {
        gap: 0.3125rem;
        flex-direction: column !important;
        display: flex !important;
      }
      
      .left {
        margin-right: auto !important;
      }
      
      .right {
        margin-left: auto !important;
      }
      
      .button.link,
      button.link {
        text-align: left;
      }
      
      .button.link:hover,
      button.link:hover {
        color: var(--accent-5) !important;
        background: 0 0 !important;
      }
      
      input[type="text"],
      input[type="number"],
      input[type="email"],
      input[type="password"],
      input[type="time"],
      input[type="url"],
      input[type="search"],
      input[type="datetime-local"],
      input[type="date"],
      textarea {
        border: 0.0625rem solid var(--shade-2);
        border-radius: var(--radius);
        background-color: var(--background);
        color: var(--foreground);
        transition: var(--border-transition);
        font-family: var(--font-sans);
        padding: 0.5rem 0.75rem;
        font-size: 1rem;
      }
      
      input[type="number"]:hover,
      input[type="text"]:hover,
      input[type="email"]:hover,
      input[type="password"]:hover,
      input[type="time"]:hover,
      input[type="url"]:hover,
      input[type="search"]:hover,
      input[type="datetime-local"]:hover,
      input[type="date"]:hover,
      textarea:hover {
        border: 0.0625rem solid var(--shade-3);
      }
      
      textarea,
      textarea:hover {
        border-style: dashed;
      }
      
      textarea:focus,
      textarea:active,
      input[type="text"]:focus,
      input[type="time"]:focus,
      input[type="url"]:focus,
      input[type="search"]:focus,
      input[type="number"]:focus,
      input[type="email"]:focus,
      input[type="password"]:focus,
      input[type="text"]:active {
        border-color: var(--link-color);
        outline: var(--link-color);
      }
      
      .react-select__control.react-select__control--is-focused,
      .react-select__control.react-select__control--menu-is-open,
      .react-select__control.react-select__control--is-focused:hover {
        border: 0.0625rem solid var(--link-color) !important;
        box-shadow: none !important;
      }
      
      .react-select__control:hover {
        border: 0.0625rem solid var(--shade-3) !important;
        box-shadow: none !important;
      }
      
      .react-select__option:first-child {
        margin-top: 0;
      }
      
      .react-select__option:last-child {
        margin-bottom: 0;
      }
      
      .react-select__clear-indicator,
      .react-select__dropdown-indicator {
        cursor: pointer;
      }
      
      .react-select__menu {
        background-color: var(--background);
        border: 0.0625rem solid var(--shade-2);
        border-radius: var(--radius);
        margin-top: 0;
        animation: 0.2s forwards slideDown;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .react-select__menu {
          transition: none !important;
          animation: none !important;
        }
      }
      
      .leaflet-container {
        background-color: var(--background);
        color: var(--foreground);
      }
      
      .leaflet-control-zoom {
        border-radius: var(--radius);
        overflow: hidden;
      }
      
      .leaflet-control-zoom-in,
      .leaflet-control-zoom-out {
        background-color: var(--background) !important;
        color: var(--foreground) !important;
        border-color: var(--shade-2) !important;
      }
      
      .leaflet-control-zoom-in:hover,
      .leaflet-control-zoom-out:hover {
        background-color: var(--shade-1) !important;
      }
      
      .leaflet-popup-content-wrapper {
        background-color: var(--background);
        color: var(--foreground);
        border-radius: var(--radius);
      }
      
      .leaflet-popup-tip {
        background-color: var(--background);
      }
      
      .leaflet-control-attribution {
        font-size: 0.625rem;
        background-color: rgba(var(--background-rgb), 0.7) !important;
        color: var(--foreground) !important;
      }
      
      .leaflet-control-attribution a {
        color: var(--link-color) !important;
      }
      
      @media (max-width: 48rem) {
        .widget-visible iframe[title="chat\ widget"] {
          margin-bottom: 3.75rem !important;
        }
      }
      
      .recharts-tooltip-wrapper {
        z-index: 99999;
      }
      
      .recharts-default-legend {
        font-size: 0.8125rem;
      }
      
      #root {
        width: 100%;
        margin: 0;
        padding: 0;
      }
      
      @keyframes fadeInScale {
        0% {
          opacity: 0;
          transform: scale(0.8);
        }
      
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      
      button.link.bookmark:hover {
        color: var(--accent-1) !important;
      }
      
      button.link.bookmark:hover svg {
        fill: var(--accent-1) !important;
        color: var(--accent-1) !important;
      }
      
      button.favorite:hover svg {
        fill: var(--accent-1);
      }
      
      .chatTextArea,
      .chatTextArea:focus,
      .chatTextArea:active,
      .chatTextArea:hover {
        resize: none;
        background-color: #0000;
        border: none;
        outline: none;
      }
      
      .select {
        appearance: none;
        border: 1px dashed var(--accent-1);
        border-radius: var(--radius);
        background-color: var(--background);
        color: var(--foreground);
        transition: var(--border-transition);
        cursor: pointer;
        padding: 0.5rem 2.5rem 0.5rem 0.5rem;
      }
      
      .select:focus,
      .select:hover,
      .select:active {
        border-color: var(--link-color);
        outline: var(--link-color);
      }
      
      .chat:hover,
      .chat:focus,
      .chat.focus {
        border-color: var(--accent-5);
        box-shadow: 0 0 5px var(--accent-5);
      }
      
      .chat:active {
        border-color: var(--accent-6);
        box-shadow: 0 0 5px var(--accent-6);
      }
      
      @media (prefers-reduced-motion: reduce) {
        .chat {
          transition: none !important;
          animation: none !important;
        }
      }
      
      .glow {
        animation: 3s ease-in-out glowPulse;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .glow {
          transition: none !important;
          animation: none !important;
        }
      }
      
      .blur {
        -webkit-backdrop-filter: blur(13px);
        backdrop-filter: blur(13px);
      }
      
      .dateTimeInput {
        margin-left: auto;
        transition: all 0.2s;
        font-family: var(--font-mono) !important;
        font-size: 13.5px !important;
      }
      
      .dateTimeInput:invalid {
        border-color: var(--accent-0);
      }
      
      .dateTimeInput::-webkit-calendar-picker-indicator {
        filter: invert(0.5);
        cursor: pointer;
      }
      
      .dateTimeInput::-webkit-calendar-picker-indicator:hover {
        filter: invert(0.3);
      }
      
      .descriptionView a {
        color: var(--primary);
        text-decoration: underline;
      }
      
      .descriptionView a:hover {
        color: var(--primary-dark);
      }
      
      .formSwitch {
        -webkit-tap-highlight-color: #0000;
      }
      
      .formSwitchTrack {
        transition: all 0.3s linear;
      }
      
      .formSwitchThumbChecked {
        transform: translate(20px);
      }
      
      @keyframes glowPulse {
        0% {
          border-color: var(--glow-color);
          box-shadow: 0 0 3px var(--glow-color);
        }
      
        to {
          border-color: var(--glow-color);
          box-shadow:
            0 0 5px var(--glow-color),
            0 0 7px var(--glow-color),
            inset 0 0 4px var(--glow-color);
        }
      }
      
      .letsFocusContainer {
        cursor: pointer;
      }
      
      .letsFocusContainer:hover .videoPlay,
      .letsFocusContainer:hover .videoPause {
        display: inline-flex !important;
      }
      
      .pointer {
        cursor: pointer;
      }
      
      .spinner {
        color: var(--accent-6);
        animation: 1s linear infinite rotation;
      }
      
      @keyframes rotation {
        0% {
          transform: rotate(0);
        }
      
        to {
          transform: rotate(360deg);
        }
      }
      
      .fullScreen {
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100dvh;
        display: flex;
      }
      
      .card.border:hover {
        border-color: var(--accent-1) !important;
        border-style: solid !important;
      }
      
      .float {
        animation: 2.5s ease-in-out forwards float;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .float {
          transition: none !important;
          animation: none !important;
        }
      }
      
      .slideInFromLeft {
        animation: 0.5s ease-out forwards slideInFromLeft;
      }
      
      @keyframes slideInFromLeft {
        0% {
          opacity: 0;
          left: -20px;
        }
      
        to {
          opacity: 1;
          left: -5px;
        }
      }
      
      .pulse {
        animation: 1s ease-in-out pulse;
      }
      
      #city-modal .react-select__menu-portal {
        position: absolute;
        top: 55px !important;
        left: 12.5px !important;
      }
      
      @keyframes typing {
        0%,
        60%,
        to {
          opacity: 0.5;
          transform: scale(1);
        }
      
        30% {
          opacity: 1;
          transform: scale(1.2);
        }
      }
      
      .typing {
        animation: 1.4s ease-in-out infinite typing;
      }
      
      .link {
        color: var(--accent-6);
        cursor: pointer;
        box-shadow: none;
        background-color: #0000;
        align-items: center;
        gap: 0.3125rem;
        margin: 0;
        padding: 0;
        text-decoration: none;
        display: inline-flex;
      }
      
      .link:hover {
        color: var(--accent-5);
        background-color: #0000;
        text-decoration: none;
      }
      
      .link:active {
        transform: translateY(0.075rem);
      }
      
      button.small,
      .button.small {
        padding: 0.35rem 0.55rem;
      }
      
      button.xSmall,
      .button.xSmall {
        padding: 0.25rem 0.45rem;
        font-size: 0.75rem;
      }
      
      a.link:hover {
        color: var(--accent-5) !important;
      }
      
      button.large,
      .button.large {
        padding: 0.5rem 1.25rem;
        font-size: 1rem;
      }
      
      button.transparent,
      .button.transparent {
        background-color: var(--background);
        color: var(--foreground);
        border: 0.0625rem solid var(--shade-2);
        box-shadow: none;
      }
      
      button.transparent:hover,
      .button.transparent:hover {
        background-color: var(--shade-1);
        color: var(--foreground);
      }
      
      button.inverted,
      .button.inverted {
        background-color: var(--foreground);
        color: var(--background);
        border: 0.0625rem solid var(--shade-2);
        box-shadow: none;
      }
      
      button.inverted:hover,
      .button.inverted:hover {
        background-color: var(--shade-7);
        color: var(--background);
      }
      
      .row {
        flex-flow: wrap;
        align-items: center;
        gap: 0.3125rem;
        display: flex;
      }
      
      
      .storeApp:hover {
        outline: 2px solid var(--accent-1);
      }
      
      ::view-transition-old(root) {
        animation-duration: 0.2s;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      ::view-transition-new(root) {
        animation-duration: 0.2s;
        animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      ::view-transition-old(root) {
        animation-name: slide-down;
      }
      
      ::view-transition-new(root) {
        animation-name: slide-up;
      }
      
      @media (max-width: 600px) {
        ::view-transition-old(root) {
          animation-name: slide-to-left;
        }
      
        ::view-transition-new(root) {
          animation-name: slide-from-right;
        }
      }
      
      @keyframes fade-out {
        to {
          opacity: 0;
        }
      }
      
      @keyframes fade-in {
        0% {
          opacity: 0;
        }
      }
      
      @keyframes scale-up {
        0% {
          opacity: 0;
          transform: scale(0.9);
        }
      }
      
      @keyframes scale-down {
        to {
          opacity: 0;
          transform: scale(0.9);
        }
      }
      
      @keyframes slide-up {
        0% {
          opacity: 0;
          transform: translateY(10px);
        }
      }
      
      @keyframes slide-down {
        to {
          opacity: 0;
          transform: translateY(10px);
        }
      }
      
      @keyframes slide-to-left {
        to {
          opacity: 0;
          transform: translate(-100%);
        }
      }
      
      @keyframes slide-from-right {
        0% {
          opacity: 0;
          transform: translate(100%);
        }
      }
      
      @media (prefers-reduced-motion: no-preference) {
        ::view-transition-old(app-image) {
          mix-blend-mode: normal;
          animation-duration: 0.4s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          overflow: clip;
        }
      
        ::view-transition-new(app-image) {
          mix-blend-mode: normal;
          animation-duration: 0.4s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          overflow: clip;
        }
      
        ::view-transition-old(app-image) {
          animation-name: scale-down;
        }
      
        ::view-transition-new(app-image) {
          animation-name: scale-up;
        }
      
        ::view-transition-old(app-title) {
          animation-duration: 0.35s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      
        ::view-transition-new(app-title) {
          animation-duration: 0.35s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        }
      
        ::view-transition-old(app-title) {
          animation-name: slide-down;
        }
      
        ::view-transition-new(app-title) {
          animation-name: slide-up;
        }
      
        ::view-transition-old(image-enlarge) {
          animation-duration: 0.3s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          overflow: clip;
        }
      
        ::view-transition-new(image-enlarge) {
          animation-duration: 0.3s;
          animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          overflow: clip;
        }
      
        ::view-transition-old(image-enlarge) {
          animation-name: scale-down;
        }
      
        ::view-transition-new(image-enlarge) {
          animation-name: scale-up;
        }
      
        ::view-transition-old(modal) {
          animation-duration: 0.25s;
          animation-timing-function: ease-in-out;
        }
      
        ::view-transition-new(modal) {
          animation-duration: 0.25s;
          animation-timing-function: ease-in-out;
        }
      
        ::view-transition-old(modal) {
          animation-name: fade-out;
        }
      
        ::view-transition-new(modal) {
          animation-name: scale-up;
        }
      
        ::view-transition-old(content-section) {
          animation-duration: 0.2s;
          animation-timing-function: ease-in-out;
          animation-name: fade-out;
        }
      
        ::view-transition-new(content-section) {
          animation-duration: 0.2s;
          animation-timing-function: ease-in-out;
        }
      
        ::view-transition-new(content-section) {
          animation-name: fade-in;
        }
      }
      
      @media (prefers-reduced-motion: no-preference) {
        .page-transitions ::view-transition-old(root) {
          animation-duration: 0.2s;
          animation-timing-function: ease-in-out;
        }
      
        .page-transitions ::view-transition-new(root) {
          animation-duration: 0.2s;
          animation-timing-function: ease-in-out;
        }
      
        .page-transitions ::view-transition-old(root) {
          animation-name: fade-out;
        }
      
        .page-transitions ::view-transition-new(root) {
          animation-name: fade-in;
        }
      
        .page-transitions ::view-transition-old(main-content) {
          animation: 0.15s ease-out fade-out;
        }
      
        .page-transitions ::view-transition-new(main-content) {
          animation: 0.2s ease-in fade-in;
        }
      }
    </style>
  </head>
  <body>
    <div id="root">${html}</div>
  </body>
</html>`)
})

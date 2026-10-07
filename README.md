# AVIS WhatsApp Sender 🩸📱

> **Desktop application designed for AVIS non-profit donor associations, enabling automated, personalized WhatsApp communications and reminders directly via WhatsApp Web.**

[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)](https://github.com/CorsiDanilo/AvisWhatsAppSender)
[![CI Build](https://github.com/CorsiDanilo/AvisWhatsAppSender/actions/workflows/build_installer.yml/badge.svg)](https://github.com/CorsiDanilo/AvisWhatsAppSender/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

**AVIS WhatsApp Sender** is an intuitive, privacy-first desktop application created to assist local AVIS Comunale sections in communicating with blood donors. It allows operators to load donor spreadsheets, customize reminder templates with donor names and donation details, attach promotional or informational images, and send messages safely through an authenticated WhatsApp Web session.

All donor data and WhatsApp credentials remain strictly **local** on the operator's machine—no donor data is ever uploaded to external servers or cloud services.

---

## ✨ Features

- **📊 Smart Recipient Import**: Load donor lists from `.xlsx`, `.xls`, or `.csv` files. Map custom columns (e.g. *Nome*, *Telefono*, *Gruppo Sanguigno*) and filter valid/invalid phone numbers.
- **✍️ Dynamic Template Composer**: Personalize messages using placeholders such as `[nome]`, `[cognome]`, etc. Save and switch between reusable message templates and presets.
- **🖼️ Image Attachment & Captioning**: Attach flyers, posters, or announcements to messages with preview and validation.
- **🛡️ Humanized Anti-Ban Rhythm**: Protect WhatsApp accounts from spam detection with configurable randomized delays between messages (e.g., 20–40s) and mandatory cooldown pauses every batch (e.g., 15 minutes every 35 messages).
- **⏯️ Live Queue Dashboard**: Monitor transmission progress in real-time with pause, resume, and emergency stop controls.
- **📁 Audit & Outcome Export**: Automatic generation of delivery logs and summary spreadsheets (`.xlsx`) recording successfully delivered, failed, and skipped messages.
- **🔄 In-App Auto-Updates**: Automatic background checks on startup and manual check via *Impostazioni → Aggiornamenti*, powered by GitHub Releases.
- **🚀 Automated Windows CI/CD**: Clean build pipeline using GitHub Actions to automatically generate NSIS Windows standalone installers (`.exe`) on release tags.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Desktop Runtime** | [Electron](https://www.electronjs.org/) (Node.js) |
| **Frontend UI** | [React 19](https://react.dev/), [Vite](https://vite.dev/), Modern Vanilla CSS |
| **WhatsApp Automation** | [whatsapp-web.js](https://wwebjs.dev/) with bundled Puppeteer / Chromium |
| **Spreadsheets & Data** | [xlsx](https://sheetjs.com/) |
| **Auto-Updates & Packaging** | [electron-updater](https://www.electron.build/auto-update), [electron-builder](https://www.electron.build/) (NSIS) |
| **Continuous Integration** | GitHub Actions (`windows-latest`) |

---

## 📥 Installation

1. Navigate to the [Releases page](https://github.com/CorsiDanilo/AvisWhatsAppSender/releases).
2. Download the latest installer: `AVIS WhatsApp Sender Setup <version>.exe`.
3. Run the installer and launch the application.

> Subsequent updates will be automatically detected and can be installed directly from the app interface.

---

## 💻 Development & Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- `npm` (v10+)
- Windows OS (for building the NSIS Windows installer)

### 1. Clone the repository

```bash
git clone https://github.com/CorsiDanilo/AvisWhatsAppSender.git
cd AvisWhatsAppSender
```

### 2. Install dependencies

```bash
npm install
npm --prefix gui install
```

### 3. Run in development mode

```bash
npm start
```
*(This automatically runs `npm run build:gui` beforehand and launches Electron).*

### 4. Build Windows Installer locally

To build the standalone NSIS installer executable:

```bash
npm run build:win
```

The resulting `.exe` installer will be located in the `dist/` directory.

---

## 🔄 Automated Release Workflow

This project is configured with a GitHub Actions workflow ([`.github/workflows/build_installer.yml`](.github/workflows/build_installer.yml)).

To publish a new official release:
1. Update `"version"` in `package.json` (e.g. `1.1.0`).
2. Update [`CHANGELOG.md`](CHANGELOG.md) with release notes.
3. Commit changes to `main`:
   ```bash
   git add -A
   git commit -m "chore: bump version to 1.1.0"
   git push origin main
   ```
4. Create and push an annotated tag matching the version:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```
5. GitHub Actions will automatically validate the version, build the Windows installer, and create a public GitHub Release with updater metadata.

---

## 🔒 Privacy & Safety Notice

- **No Data Collection**: This tool does not transmit donor data, contact details, or messages to third-party services.
- **WhatsApp Terms of Service**: Always ensure you have donor consent before sending WhatsApp messages. Respect message pacing limits to avoid account restrictions or bans.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

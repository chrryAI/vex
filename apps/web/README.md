# Vex Web Application

This is the main web-based frontend for the Vex platform. It is a Next.js application that provides a rich, interactive user experience.

## ✨ Features

- **AI Chat**: A full-featured AI chat interface for interacting with the Vex platform.
- **Multi-App PWA**: The web app supports the multi-app PWA architecture, allowing users to install different Vex apps on their home screen.
- **App Marketplace**: Users can browse and install specialized AI apps from the app marketplace.
- **Real-Time Collaboration**: The web app supports real-time collaboration features.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 9+

### Setup Instructions

1.  **Install dependencies**:

    ```bash
    pnpm install
    ```

2.  **Set up environment variables**:

    Copy the `.env.example` file to `.env` and fill in the required values:

    ```bash
    cp .env.example .env
    ```

3.  **Run the development server**:

    ```bash
    pnpm dev
    ```

    The web app will be available at `http://localhost:3000`.

## 🛠️ Development

To build the web app for production, run the following command:

```bash
pnpm build
```

To start the production server, run:

```bash
pnpm start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

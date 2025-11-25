# Vex WebSocket Server

This is the WebSocket server for the Vex platform. It is built using Express and the `ws` library, and it is responsible for handling real-time communication for the Vex chat service.

## ✨ Features

*   **Real-Time Chat**: The WebSocket server enables real-time, bidirectional communication between clients and the Vex platform.
*   **Scalable**: The server is designed to be scalable to handle a large number of concurrent connections.
*   **Secure**: The server includes authentication and authorization mechanisms to ensure that only authorized users can connect.

## 🚀 Getting Started

### Prerequisites

*   Node.js 18+
*   pnpm 9+

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

    The WebSocket server will be available at `ws://localhost:5001`.

## 🛠️ Development

To build the WebSocket server for production, run the following command:

```bash
pnpm build
```

To start the production server, run:

```bash
pnpm start
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

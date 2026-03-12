# Chrry API

This is the API application for the Chrry marketplace. It provides a comprehensive set of API endpoints for managing apps, stores, and other resources on the Vex platform.

## ✨ Features

- **Bun API Routes**: The API is built using Bun and Hono, providing a simple and intuitive way to create API endpoints.
- **Authentication and Authorization**: The API includes a robust authentication and authorization system to ensure that only authorized users can access protected resources.
- **AI Integration**: The API is integrated with a wide range of AI and machine learning services.
- **Database Integration**: The API is integrated with the Vex database, providing a type-safe and efficient way to interact with the database.

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

    The API will be available at `http://localhost:3001`.

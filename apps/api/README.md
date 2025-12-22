# Chrry API

This is the Next.js API application for the Chrry marketplace. It provides a comprehensive set of API endpoints for managing apps, stores, and other resources on the Vex platform.

## ✨ Features

- **Next.js API Routes**: The API is built using Next.js API routes, providing a simple and intuitive way to create API endpoints.
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

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/apps` - Get all apps
- `POST /api/apps` - Create a new app
- `GET /api/stores` - Get all stores
- `POST /api/stores` - Create a new store

... and many more.

For detailed information about all the available API endpoints, see the [API Documentation](API_DOCS.md).

## 🏛️ Architecture

The `api` application is a standard Next.js app with the following structure:

```
apps/api/
├── app/
│   ├── api/          # API routes
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page
├── middleware.ts     # CORS & auth
└── package.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

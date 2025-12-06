# Chrry API Documentation

This document provides detailed documentation for the Chrry API.

## Authentication

All API endpoints require authentication. You must be authenticated as a member or a guest to use the API.

---

## AI

### POST /api/ai

This is the main endpoint for interacting with the Vex AI platform. It handles a wide range of AI-related tasks, including text generation, file processing, and multi-modal interactions.

#### Request Body

The request body can be either a JSON object or a `multipart/form-data` object.

**JSON Request Body:**

| Field                    | Type      | Description                               |
| ------------------------ | --------- | ----------------------------------------- |
| `agentId`                | `string`  | The ID of the AI agent to use.            |
| `messageId`              | `string`  | The ID of the message to process.         |
| `language`               | `string`  | The language of the request (e.g., "en"). |
| `imageGenerationEnabled` | `boolean` | Whether to enable image generation.       |
| `pauseDebate`            | `boolean` | Whether to pause a debate.                |
| `stopStreamId`           | `string`  | The ID of the stream to stop.             |
| `selectedAgentId`        | `string`  | The ID of the selected agent in a debate. |
| `isSpeechActive`         | `boolean` | Whether speech is active.                 |
| `weather`                | `object`  | The current weather conditions.           |
| `slug`                   | `string`  | The slug of the app.                      |
| `placeholder`            | `string`  | The placeholder text.                     |

**Multipart/form-data Request Body:**

In addition to the fields above, the `multipart/form-data` request body can include one or more files.

#### Response

The response is a stream of Server-Sent Events (SSE).

---

## Users

### GET /api/users

This endpoint is used to search for users by username or email, or to get a list of public users.

#### Query Parameters

| Parameter   | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `search`    | `string` | The username or email to search for.     |
| `find`      | `string` | A search query to find users.            |
| `pageSize`  | `number` | The number of users to return.           |
| `similarTo` | `string` | Find users similar to the given user ID. |

#### Response

A JSON object containing a list of users.

---

## Apps

### GET /api/apps

This endpoint retrieves a list of apps for the authenticated user.

#### Query Parameters

| Parameter | Type     | Description                    |
| --------- | -------- | ------------------------------ |
| `appId`   | `string` | The ID of the app to retrieve. |

#### Response

A JSON object containing a list of apps.

### POST /api/apps

This endpoint creates a new app.

#### Request Body

The request body should be a JSON object that conforms to the `appSchema`.

#### Response

A JSON object containing the newly created app.

# FastAlert MCP Server

Official Model Context Protocol (MCP) server for [FastAlert](https://fastalert.now). This server allows AI agents (like Claude, ChatGPT, and Cursor) to list of your channels and send notifications directly through the FastAlert API.

## Features

- **Channel Discovery**: List all of your channels with optional name filtering.
- **Send Notifications**: Send rich messages (title, content, actions, images) to one or multiple channels.

## Quick Start

```json
{
  "mcpServers": {
    "fastalert": {
      "command": "npx",
      "args": ["-y", "fastalert-mcp-server"],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

You can find your API key by visiting [FastAlert](https://fastalert.now) and navigating to [Settings](https://fastalert.now/settings).

## Available Tools

The following tools are available through this MCP server. Each tool can be called by an AI assistant to perform specific actions.

### 1. `list_channels`

Returns a list of available FastAlert channels.

**Input Parameters:**

- `name` (string, optional): A search term to filter channels by name.

**Example Call:**

```json
{
  "name": "Service Alerts"
}
```

**Structured JSON Output (Default):**

```json
{
  "status": true,
  "message": "You have fetch channels successfully",
  "data": {
    "channels": [
      {
        "uuid": "sdf12sdf-6541-5d56-s5sd-1fa513e88a81",
        "name": "Service Alerts",
        "subscriber": 1000
      }
    ]
  }
}
```

**Human-Readable Text Output:**

```text
Here are your FastAlert channels:

Service Alerts
UUID: sdf12sdf-6541-5d56-s5sd-1fa513e88a81
Subscribers: 1000
```

### 2. `send_message`

Sends a notification message to one or more channels.

**Input Parameters:**

- `channel-uuid` (string, required): The unique identifier for the target channel.
- `title` (string, required): The title of the alert notification.
- `content` (string, required): The main body text of the notification.
- `action` (string, optional): Type of action ('call', 'email', 'website', 'image').
- `action_value` (string, optional): The value for the action (e.g., a URL or phone number).
- `image` (string, optional): URL or identifier for an image to include.

**Example Call:**

```json
{
  "channel-uuid": "sdf12sdf-6541-5d56-s5sd-1fa513e88a81",
  "title": "System Update",
  "content": "A new version of the system is now live.",
  "action": "website",
  "action_value": "https://fastalert.now/updates"
}
```

**Structured JSON Output (Default):**

```json
{
  "status": true,
  "message": "Message has been sent successfully"
}
```

**Human-Readable Text Output:**

```text
Message Sent Successfully!

Your message "System Update" has been sent to Service Alerts.

Channel UUID: sdf12sdf-6541-5d56-s5sd-1fa513e88a81
Title: System Update
Content: A new version of the system is now live.
```

## Integration with LLMs

### Configuration in Cursor

1. Go to **Settings** -> **MCP**.
2. Click **Add New MCP Server**.
3. Name: `FastAlert`
4. Type: `command`
5. Command: `npx -y fastalert-mcp-server`
6. Env: Add `API_KEY`.

### Configuration in ChatGPT

1. Go to **Settings** -> **Integrations**.
2. Click **Add MCP Server**.
3. Use the hosted URL of your server (e.g., `https://mcp.fastalert.now/mcp`).
4. Follow the OAuth prompts.

### Configuration in Claude

1. Open `claude_desktop_config.json`.
2. Add the following entry:

```json
{
  "mcpServers": {
    "fastalert": {
      "command": "npx",
      "args": ["-y", "fastalert-mcp-server"],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Setup & Development

### Requirements

- **Node**: Version 18 or higher is recommended.
- **API_KEY**: A valid FastAlert API Key is required for authentication.

### Local Installation

1. Clone the repository
2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
3. Configure your environment variables in `.env`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Build the project:
   ```bash
   npm run build
   ```
6. Run inspector tests:
   ```bash
   npm run inspector
   ```
7. Run locally:
   ```bash
   npm start
   ```

### Configuration (Environment Variables)

The following environment variables should be configured in your `.env` file:

| Variable    | Description                                    | Example                         |
| ----------- | ---------------------------------------------- | ------------------------------- |
| `API_URL`   | The FastAlert API endpoint                     | `https://api.fastalert.now/api` |
| `FRONT_URL` | Your frontend application URL                  | `https://fastalert.now`         |
| `BASE_URL`  | The public URL where this MCP server is hosted | `http://localhost:3000`         |
| `API_KEY`   | Your FastAlert API Key                         | `your-api-key-here`             |
| `PORT`      | (Optional) Port to run the server on           | `3000`                          |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

---
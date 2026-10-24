# Twitter MCP Server

A powerful Twitter integration for AI agents that leverages the Model Context Protocol (MCP) standard, providing a comprehensive set of Twitter functionality through a clean and consistent interface.

## Overview

This server provides access to Twitter's features through MCP tools, allowing seamless integration with AI assistants and other MCP-compatible clients. It's built on top of the `agent-twitter-client` library and provides robust error handling, rate limiting, and consistent response formatting.

## Features

### Basic Reading
- Get tweets from users with media support
- Fetch user profiles with detailed information
- Search tweets by hashtags or keywords
- Filter search results by latest/top
- Rate limiting (max 50 tweets per request)

### User Interactions
- Like/Unlike tweets
- Retweet/Undo retweet
- Post tweets with:
  - Text content
  - Media attachments (images, videos)
  - Reply functionality
  - Quote tweet capability

### Advanced Features
- Get user relationships (followers/following)
- Fetch trending topics
- Access different timeline types:
  - Home timeline
  - Following timeline
  - User timeline
- List management (fetch list tweets)

### Media & Advanced Interactions
- Media handling:
  - Image upload (JPEG, PNG, GIF)
  - Video upload (MP4)
  - Alt text support
- Thread creation
- Follow/Unfollow users

## Tools

### Reading Tools
- `get_tweets` - Fetch recent tweets from a user
- `get_profile` - Get a user's profile information
- `search_tweets` - Search for tweets by hashtag or keyword

### Interaction Tools
- `like_tweet` - Like or unlike a tweet
- `retweet` - Retweet or undo retweet
- `post_tweet` - Post a new tweet with optional media
- `create_thread` - Create a Twitter thread

### Timeline Tools
- `get_timeline` - Get tweets from different timeline types
- `get_list_tweets` - Get tweets from a Twitter list
- `get_trends` - Get current trending topics

### User Management Tools
- `get_user_relationships` - Get followers or following list
- `follow_user` - Follow or unfollow a user

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Configure environment variables:
```bash
# Required: Twitter Account Credentials (for user authentication)
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
TWITTER_EMAIL=your_email

# Twitter API Authentication (Optional)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET_KEY=your_api_secret_key
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret
```

4. Add the server config to your MCP client:

On MacOS:
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

On Windows:
```bash
%APPDATA%/Claude/claude_desktop_config.json
```

Configuration:
```json
{
  "mcpServers": {
    "twitter-mcp-server": {
      "command": "/path/to/twitter-mcp-server/build/index.js"
    }
  }
}
```

## Development

For development with auto-rebuild:
```bash
npm run watch
```

### Debugging

Since MCP servers communicate over stdio, you can use the MCP Inspector for debugging:
```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Error Handling

The server implements comprehensive error handling:
- Input validation for all parameters
- Rate limiting protection
- Detailed error messages
- Proper error propagation
- Logging for debugging

## Response Format

All tools return responses in a consistent format:
```typescript
{
  content: [{
    type: "text",
    text: string // JSON stringified response or error message
  }]
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

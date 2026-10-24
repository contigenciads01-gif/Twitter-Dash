#!/usr/bin/env node

/**
 * This is a template MCP server that implements a simple notes system.
 * It demonstrates core MCP concepts like resources and tools by allowing:
 * - Listing notes as resources
 * - Reading individual notes
 * - Creating new notes via a tool
 * - Summarizing all notes via a prompt
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Scraper } from 'agent-twitter-client';
import { Tweet, SearchMode, Profile } from 'agent-twitter-client';

/**
 * Type alias for a note object.
 */
type Note = { title: string, content: string };

/**
 * Simple in-memory storage for notes.
 * In a real implementation, this would likely be backed by a database.
 */
const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" }
};

/**
 * Create an MCP server with capabilities for resources (to list/read notes),
 * tools (to create new notes), and prompts (to summarize notes).
 */
const server = new Server(
  {
    name: "twitter-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

// Global authenticated scraper instance
let authenticatedScraper: Scraper | null = null;

/**
 * Handler for listing available notes as resources.
 * Each note is exposed as a resource with:
 * - A note:// URI scheme
 * - Plain text MIME type
 * - Human readable name and description (now including the note title)
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.entries(notes).map(([id, note]) => ({
      uri: `note:///${id}`,
      mimeType: "text/plain",
      name: note.title,
      description: `A text note: ${note.title}`
    }))
  };
});

/**
 * Handler for reading the contents of a specific note.
 * Takes a note:// URI and returns the note content as plain text.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const id = url.pathname.replace(/^\//, '');
  const note = notes[id];

  if (!note) {
    throw new Error(`Note ${id} not found`);
  }

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "text/plain",
      text: note.content
    }]
  };
});

/**
 * Handler that lists available tools.
 * Exposes a single "create_note" tool that lets clients create new notes.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_note",
        description: "Create a new note",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the note"
            },
            content: {
              type: "string",
              description: "Text content of the note"
            }
          },
          required: ["title", "content"]
        }
      },
      {
        name: "get_tweets",
        description: "Get recent tweets from a user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the user (without @)"
            },
            count: {
              type: "number",
              description: "Number of tweets to retrieve (default: 10, max: 50)"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "get_profile",
        description: "Get a Twitter user's profile information",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the user (without @)"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "search_tweets",
        description: "Search for tweets by hashtag or keyword",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (hashtag or keyword). For hashtags, include the # symbol"
            },
            mode: {
              type: "string",
              enum: ["latest", "top"],
              description: "Search mode - 'latest' for most recent tweets or 'top' for most relevant tweets",
              default: "latest"
            },
            count: {
              type: "number",
              description: "Number of tweets to retrieve (default: 10, max: 50)"
            }
          },
          required: ["query"]
        }
      },
      {
        name: "like_tweet",
        description: "Like or unlike a tweet",
        inputSchema: {
          type: "object",
          properties: {
            tweet_id: {
              type: "string",
              description: "ID of the tweet to like/unlike"
            },
            action: {
              type: "string",
              enum: ["like", "unlike"],
              description: "Whether to like or unlike the tweet",
              default: "like"
            }
          },
          required: ["tweet_id"]
        }
      },
      {
        name: "retweet",
        description: "Retweet or undo retweet of a tweet",
        inputSchema: {
          type: "object",
          properties: {
            tweet_id: {
              type: "string",
              description: "ID of the tweet to retweet/undo retweet"
            },
            action: {
              type: "string",
              enum: ["retweet", "undo"],
              description: "Whether to retweet or undo the retweet",
              default: "retweet"
            }
          },
          required: ["tweet_id"]
        }
      },
      {
        name: "post_tweet",
        description: "Post a new tweet, optionally with media or as a quote tweet",
        inputSchema: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description: "The text content of the tweet"
            },
            reply_to_tweet_id: {
              type: "string",
              description: "Optional: ID of the tweet to reply to"
            },
            quote_tweet_id: {
              type: "string",
              description: "Optional: ID of the tweet to quote"
            },
            media: {
              type: "array",
              description: "Optional: Array of media items to attach to the tweet",
              items: {
                type: "object",
                properties: {
                  data: {
                    type: "string",
                    description: "Base64 encoded media data"
                  },
                  media_type: {
                    type: "string",
                    description: "MIME type of the media (e.g., 'image/jpeg', 'image/png', 'video/mp4')"
                  }
                },
                required: ["data", "media_type"]
              }
            },
            hide_link_preview: {
              type: "boolean",
              description: "Optional: Whether to hide link previews in the tweet",
              default: false
            }
          },
          required: ["text"]
        }
      },
      {
        name: "get_trends",
        description: "Get current trending topics on Twitter",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_user_relationships",
        description: "Get a user's followers or following list",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the user (without @)"
            },
            relationship_type: {
              type: "string",
              enum: ["followers", "following"],
              description: "Whether to get followers or following list",
              default: "followers"
            },
            count: {
              type: "number",
              description: "Number of profiles to retrieve (default: 10, max: 50)"
            }
          },
          required: ["username", "relationship_type"]
        }
      },
      {
        name: "get_timeline",
        description: "Get tweets from a user's timeline or home timeline",
        inputSchema: {
          type: "object",
          properties: {
            timeline_type: {
              type: "string",
              enum: ["home", "following", "user"],
              description: "Type of timeline to fetch: 'home' for your personalized timeline, 'following' for tweets from people you follow, or 'user' for a specific user's timeline",
              default: "home"
            },
            username: {
              type: "string",
              description: "Username of the user whose timeline to fetch (required only for timeline_type='user')"
            },
            count: {
              type: "number",
              description: "Number of tweets to retrieve (default: 10, max: 50)"
            }
          },
          required: ["timeline_type"]
        }
      },
      {
        name: "get_list_tweets",
        description: "Get tweets from a Twitter list",
        inputSchema: {
          type: "object",
          properties: {
            list_id: {
              type: "string",
              description: "ID of the Twitter list to fetch tweets from"
            },
            count: {
              type: "number",
              description: "Number of tweets to retrieve (default: 10, max: 50)"
            }
          },
          required: ["list_id"]
        }
      },
      {
        name: "follow_user",
        description: "Follow or unfollow a Twitter user",
        inputSchema: {
          type: "object",
          properties: {
            username: {
              type: "string",
              description: "Username of the user to follow/unfollow (without @)"
            },
            action: {
              type: "string",
              enum: ["follow", "unfollow"],
              description: "Whether to follow or unfollow the user",
              default: "follow"
            }
          },
          required: ["username"]
        }
      },
      {
        name: "create_thread",
        description: "Create a Twitter thread (a series of connected tweets)",
        inputSchema: {
          type: "object",
          properties: {
            tweets: {
              type: "array",
              description: "Array of tweet objects containing the content for each tweet in the thread",
              items: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description: "The text content of the tweet"
                  },
                  media: {
                    type: "array",
                    description: "Optional: Array of media items to attach to the tweet",
                    items: {
                      type: "object",
                      properties: {
                        data: {
                          type: "string",
                          description: "Base64 encoded media data"
                        },
                        media_type: {
                          type: "string",
                          description: "MIME type of the media (e.g., 'image/jpeg', 'image/png', 'video/mp4')"
                        }
                      },
                      required: ["data", "media_type"]
                    }
                  }
                },
                required: ["text"]
              }
            }
          },
          required: ["tweets"]
        }
      }
    ]
  };
});

/**
 * Handler for the create_note tool.
 * Creates a new note with the provided title and content, and returns success message.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "create_note": {
      const title = String(request.params.arguments?.title);
      const content = String(request.params.arguments?.content);
      if (!title || !content) {
        return {
          content: [{
            type: "text",
            text: "Error: Title and content are required"
          }]
        };
      }

      const id = String(Object.keys(notes).length + 1);
      notes[id] = { title, content };

      return {
        content: [{
          type: "text",
          text: `Created note ${id}: ${title}`
        }]
      };
    }
    case "get_tweets": {
      // Input validation
      if (!request.params.arguments?.username) {
        return {
          content: [{
            type: "text",
            text: "Error: Username is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      // Clean up username (remove @ if present and any whitespace)
      const username = String(request.params.arguments.username).replace('@', '').trim();
      const count = Math.min(Number(request.params.arguments?.count) || 10, 50); // Default to 10, max 50

      const date = String(request.params.arguments?.date);
      
      try {
        // First get the user ID
        const userId = await authenticatedScraper.getUserIdByScreenName(username);
        
        // Then get tweets using the user ID
        const tweetIterator = authenticatedScraper.getUserTweetsIterator(userId, count);
        const tweets: Tweet[] = [];
        
        for await (const tweet of tweetIterator) {
          if (tweet.timeParsed) {
            if (date) {
              const tweetDate = new Date(tweet.timeParsed).toISOString().slice(0, 10);
              if (tweetDate === date) {
                tweets.push(tweet);
              }
            } else {
              tweets.push(tweet);
            }
            if (tweets.length >= count) break;
          }
        }
        
        // Format tweets for better readability
        const formattedTweets = tweets.map((tweet: Tweet) => ({
          id: tweet.id,
          text: tweet.text,
          created_at: tweet.timeParsed,
          metrics: {
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views
          },
          urls: tweet.urls,
          hashtags: tweet.hashtags,
          is_retweet: tweet.isRetweet,
          is_reply: tweet.isReply
        }));

        return {
          content: [{
            type: "text",
            text: formattedTweets.length > 0
              ? JSON.stringify(formattedTweets, null, 2)
              : `No tweets found for user @${username}`
          }]
        };
      } catch (error) {
        console.error('Error fetching tweets:', error);
        
        // Provide more specific error messages
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to fetch tweets. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }
    case "get_profile": {
      // Input validation
      if (!request.params.arguments?.username) {
        return {
          content: [{
            type: "text",
            text: "Error: Username is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      // Clean up username (remove @ if present and any whitespace)
      const username = String(request.params.arguments.username).replace('@', '').trim();

      try {
        const profile = await authenticatedScraper.getProfile(username);
        
        // Format profile for better readability
        const formattedProfile = {
          id: profile.userId,
          username: profile.username,
          displayName: profile.name,
          bio: profile.biography,
          location: profile.location,
          website: profile.website,
          joinDate: profile.joined,
          metrics: {
            tweets: profile.tweetsCount,
            followers: profile.followersCount,
            following: profile.followingCount,
            likes: profile.likesCount,
            listed: profile.listedCount
          },
          isVerified: profile.isVerified,
          isBlueVerified: profile.isBlueVerified,
          isPrivate: profile.isPrivate,
          avatar: profile.avatar,
          banner: profile.banner
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedProfile, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error fetching profile:', error);
        
        // Provide more specific error messages
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to fetch profile. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "search_tweets": {
      // Input validation
      if (!request.params.arguments?.query) {
        return {
          content: [{
            type: "text",
            text: "Error: Search query is required"
          }]
        };
      }

      const query = String(request.params.arguments.query).trim();
      const mode = (request.params.arguments?.mode || 'latest') as 'latest' | 'top';
      const count = Math.min(Number(request.params.arguments?.count) || 10, 50);
      
      try {
        if (!authenticatedScraper) {
          return {
            content: [{
              type: "text",
              text: "Error: Twitter API is not properly initialized. Please check the server logs."
            }]
          };
        }
        
        // Convert mode string to SearchMode enum
        const searchMode = mode === 'latest' ? SearchMode.Latest : SearchMode.Top;
        
        // Search for tweets
        const tweetIterator = authenticatedScraper.searchTweets(query, count, searchMode);
        const tweets: Tweet[] = [];
        
        for await (const tweet of tweetIterator) {
          tweets.push(tweet);
          if (tweets.length >= count) break;
        }
        
        // Format tweets for better readability
        const formattedTweets = tweets.map((tweet: Tweet) => ({
          id: tweet.id,
          text: tweet.text,
          author: {
            id: tweet.userId,
            username: tweet.username,
            displayName: tweet.name
          },
          created_at: tweet.timeParsed,
          metrics: {
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views
          },
          urls: tweet.urls,
          hashtags: tweet.hashtags,
          is_retweet: tweet.isRetweet,
          is_reply: tweet.isReply
        }));

        return {
          content: [{
            type: "text",
            text: formattedTweets.length > 0
              ? JSON.stringify(formattedTweets, null, 2)
              : `No tweets found for query: ${query}`
          }]
        };
      } catch (error) {
        console.error('Error searching tweets:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to search tweets. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "like_tweet": {
      // Input validation
      if (!request.params.arguments?.tweet_id) {
        return {
          content: [{
            type: "text",
            text: "Error: Tweet ID is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const tweetId = String(request.params.arguments.tweet_id);
      const action = String(request.params.arguments?.action || 'like');

      try {
        await authenticatedScraper.likeTweet(tweetId);
        return {
          content: [{
            type: "text",
            text: `Successfully ${action === 'like' ? 'liked' : 'unliked'} tweet ${tweetId}`
          }]
        };
      } catch (error) {
        console.error('Error liking/unliking tweet:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : `Error: Failed to ${action} tweet. Please try again later.`;
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "retweet": {
      // Input validation
      if (!request.params.arguments?.tweet_id) {
        return {
          content: [{
            type: "text",
            text: "Error: Tweet ID is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const tweetId = String(request.params.arguments.tweet_id);
      const action = String(request.params.arguments?.action || 'retweet');

      try {
        await authenticatedScraper.retweet(tweetId);
        return {
          content: [{
            type: "text",
            text: `Successfully ${action === 'retweet' ? 'retweeted' : 'undid retweet'} tweet ${tweetId}`
          }]
        };
      } catch (error) {
        console.error('Error retweeting/unretweeting tweet:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : `Error: Failed to ${action} tweet. Please try again later.`;
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "post_tweet": {
      // Input validation
      if (!request.params.arguments?.text) {
        return {
          content: [{
            type: "text",
            text: "Error: Tweet text is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const text = String(request.params.arguments.text);
      const replyToTweetId = request.params.arguments?.reply_to_tweet_id ? String(request.params.arguments.reply_to_tweet_id) : undefined;
      const quoteTweetId = request.params.arguments?.quote_tweet_id ? String(request.params.arguments.quote_tweet_id) : undefined;
      
      try {
        let mediaData: { data: Buffer; mediaType: string }[] | undefined;
        
        // Process media if provided
        if (request.params.arguments?.media && Array.isArray(request.params.arguments.media)) {
          mediaData = request.params.arguments.media.map((item: { data: string; media_type: string }) => ({
            data: Buffer.from(String(item.data), 'base64'),
            mediaType: String(item.media_type)
          }));
        }

        let result;
        if (quoteTweetId) {
          // Quote tweet
          result = await authenticatedScraper.sendTweet(
            text,
            quoteTweetId,
            mediaData
          );
          
          if (!result.ok) {
            throw new Error(`Failed to create quote tweet: ${await result.text()}`);
          }
        } else {
          // Regular tweet or reply
          result = await authenticatedScraper.sendTweet(
            text,
            replyToTweetId,
            mediaData
          );
          
          if (!result.ok) {
            throw new Error(`Failed to create tweet: ${await result.text()}`);
          }
        }

        let tweetId: string | undefined;
        try {
          const responseData = await result.json();
          tweetId = responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
        } catch (_) {}

        return {
          content: [{
            type: "text",
            text: tweetId 
              ? `Successfully posted tweet with ID: ${tweetId}`
              : (quoteTweetId 
                ? `Successfully posted quote tweet`
                : replyToTweetId 
                  ? `Successfully posted reply to tweet ${replyToTweetId}`
                  : `Successfully posted tweet`)
          }]
        };
      } catch (error) {
        console.error('Error posting tweet:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to post tweet. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "get_trends": {
      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      try {
        const trends = await authenticatedScraper.getTrends();
        
        return {
          content: [{
            type: "text",
            text: trends.length > 0
              ? JSON.stringify(trends, null, 2)
              : "No trending topics found at the moment"
          }]
        };
      } catch (error) {
        console.error('Error fetching trends:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to fetch trending topics. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "get_user_relationships": {
      // Input validation
      if (!request.params.arguments?.username) {
        return {
          content: [{
            type: "text",
            text: "Error: Username is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      // Clean up username and get parameters
      const username = String(request.params.arguments.username).replace('@', '').trim();
      const relationshipType = String(request.params.arguments?.relationship_type || 'followers');
      const count = Math.min(Number(request.params.arguments?.count) || 10, 50); // Default to 10, max 50
      
      try {
        // First get the user ID
        const userId = await authenticatedScraper.getUserIdByScreenName(username);
        
        // Get the profiles based on relationship type
        const profileIterator = relationshipType === 'followers'
          ? authenticatedScraper.getFollowers(userId, count)
          : authenticatedScraper.getFollowing(userId, count);
        
        const profiles: Profile[] = [];
        
        for await (const profile of profileIterator) {
          profiles.push(profile);
          if (profiles.length >= count) break;
        }
        
        // Format profiles for better readability
        const formattedProfiles = profiles.map(profile => ({
          id: profile.userId,
          username: profile.username,
          displayName: profile.name,
          bio: profile.biography,
          metrics: {
            tweets: profile.tweetsCount,
            followers: profile.followersCount,
            following: profile.followingCount
          },
          isVerified: profile.isVerified,
          isPrivate: profile.isPrivate,
          avatar: profile.avatar
        }));

        return {
          content: [{
            type: "text",
            text: formattedProfiles.length > 0
              ? JSON.stringify(formattedProfiles, null, 2)
              : `No ${relationshipType} found for user @${username}`
          }]
        };
      } catch (error) {
        console.error(`Error fetching ${relationshipType}:`, error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : `Error: Failed to fetch ${relationshipType}. Please try again later.`;
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "get_timeline": {
      // Input validation
      if (!request.params.arguments?.timeline_type) {
        return {
          content: [{
            type: "text",
            text: "Error: Timeline type is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const timelineType = String(request.params.arguments.timeline_type);
      const username = request.params.arguments?.username ? String(request.params.arguments.username).replace('@', '').trim() : undefined;
      const count = Math.min(Number(request.params.arguments?.count) || 10, 50);
      
      try {
        let tweets: Tweet[] = [];
        
        if (timelineType === 'home') {
          // For home timeline, we don't need seen tweet IDs for first fetch
          const homeTimelineTweets = await authenticatedScraper.fetchHomeTimeline(count, []);
          tweets = homeTimelineTweets.map((tweet: Tweet) => ({
            id: tweet.id,
            text: tweet.text,
            userId: tweet.userId,
            username: tweet.username,
            name: tweet.name,
            timeParsed: tweet.timeParsed,
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views,
            urls: tweet.urls || [],
            hashtags: tweet.hashtags || [],
            mentions: tweet.mentions || [],
            photos: tweet.photos || [],
            videos: tweet.videos || [],
            thread: tweet.thread || [],
            isRetweet: tweet.isRetweet || false,
            isReply: tweet.isReply || false
          }));
        } else if (timelineType === 'following') {
          // For following timeline, we don't need seen tweet IDs for first fetch
          const followingTimelineTweets = await authenticatedScraper.fetchFollowingTimeline(count, []);
          tweets = followingTimelineTweets.map((tweet: Tweet) => ({
            id: tweet.id,
            text: tweet.text,
            userId: tweet.userId,
            username: tweet.username,
            name: tweet.name,
            timeParsed: tweet.timeParsed,
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views,
            urls: tweet.urls || [],
            hashtags: tweet.hashtags || [],
            mentions: tweet.mentions || [],
            photos: tweet.photos || [],
            videos: tweet.videos || [],
            thread: tweet.thread || [],
            isRetweet: tweet.isRetweet || false,
            isReply: tweet.isReply || false
          }));
        } else if (timelineType === 'user') {
          if (!username) {
            return {
              content: [{
                type: "text",
                text: "Error: Username is required for user timeline"
              }]
            };
          }
          
          // First get the user ID
          const userId = await authenticatedScraper.getUserIdByScreenName(username);
          
          // Then get tweets using the user ID
          const tweetIterator = authenticatedScraper.getUserTweetsIterator(userId, count);
          
          for await (const tweet of tweetIterator) {
            tweets.push(tweet);
            if (tweets.length >= count) break;
          }
        } else {
          return {
            content: [{
              type: "text",
              text: "Error: Invalid timeline type"
            }]
          };
        }
        
        // Format tweets for better readability
        const formattedTweets = tweets.map((tweet: Tweet) => ({
          id: tweet.id,
          text: tweet.text,
          author: {
            id: tweet.userId,
            username: tweet.username,
            displayName: tweet.name
          },
          created_at: tweet.timeParsed,
          metrics: {
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views
          },
          urls: tweet.urls,
          hashtags: tweet.hashtags,
          is_retweet: tweet.isRetweet,
          is_reply: tweet.isReply
        }));

        return {
          content: [{
            type: "text",
            text: formattedTweets.length > 0
              ? JSON.stringify(formattedTweets, null, 2)
              : `No tweets found for ${timelineType} timeline${username ? ` of user @${username}` : ''}`
          }]
        };
      } catch (error) {
        console.error('Error fetching timeline:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to fetch timeline. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "get_list_tweets": {
      // Input validation
      if (!request.params.arguments?.list_id) {
        return {
          content: [{
            type: "text",
            text: "Error: List ID is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const listId = String(request.params.arguments.list_id);
      const count = Math.min(Number(request.params.arguments?.count) || 10, 50);
      
      try {
        const response = await authenticatedScraper.fetchListTweets(listId, count);
        const tweets = response.tweets;
        
        // Format tweets for better readability
        const formattedTweets = tweets.map((tweet: Tweet) => ({
          id: tweet.id,
          text: tweet.text,
          author: {
            id: tweet.userId,
            username: tweet.username,
            displayName: tweet.name
          },
          created_at: tweet.timeParsed,
          metrics: {
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            views: tweet.views
          },
          urls: tweet.urls,
          hashtags: tweet.hashtags,
          is_retweet: tweet.isRetweet,
          is_reply: tweet.isReply
        }));

        return {
          content: [{
            type: "text",
            text: formattedTweets.length > 0
              ? JSON.stringify(formattedTweets, null, 2)
              : `No tweets found for list ${listId}`
          }]
        };
      } catch (error) {
        console.error('Error fetching list tweets:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to fetch list tweets. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "follow_user": {
      // Input validation
      if (!request.params.arguments?.username) {
        return {
          content: [{
            type: "text",
            text: "Error: Username is required"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      const username = String(request.params.arguments.username).replace('@', '').trim();
      const action = String(request.params.arguments?.action || 'follow');

      try {
        // Get user ID from username
        const userId = await authenticatedScraper.getUserIdByScreenName(username);

        // Prepare the request body
        const requestBody = {
          include_profile_interstitial_type: '1',
          skip_status: 'true',
          user_id: userId
        };

        // Prepare the headers
        const headers = new Headers({
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `https://twitter.com/${username}`,
          'X-Twitter-Active-User': 'yes',
          'X-Twitter-Auth-Type': 'OAuth2Session',
          'X-Twitter-Client-Language': 'en'
        });

        // Install auth headers
        await (authenticatedScraper as any).auth.installTo(
          headers, 
          action === 'follow' 
            ? 'https://api.twitter.com/1.1/friendships/create.json'
            : 'https://api.twitter.com/1.1/friendships/destroy.json'
        );

        // Make the follow/unfollow request
        const res = await (authenticatedScraper as any).auth.fetch(
          action === 'follow'
            ? 'https://api.twitter.com/1.1/friendships/create.json'
            : 'https://api.twitter.com/1.1/friendships/destroy.json',
          {
            method: 'POST',
            headers,
            body: new URLSearchParams(requestBody).toString(),
            credentials: 'include'
          }
        );

        if (!res.ok) {
          throw new Error(`Failed to ${action} user: ${res.statusText}`);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully ${action === 'follow' ? 'followed' : 'unfollowed'} user @${username}`
          }]
        };
      } catch (error) {
        console.error(`Error ${action}ing user:`, error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : `Error: Failed to ${action} user. Please try again later.`;
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    case "create_thread": {
      // Input validation
      if (!request.params.arguments?.tweets || !Array.isArray(request.params.arguments.tweets)) {
        return {
          content: [{
            type: "text",
            text: "Error: tweets array is required"
          }]
        };
      }

      if (request.params.arguments.tweets.length < 2) {
        return {
          content: [{
            type: "text",
            text: "Error: A thread must contain at least 2 tweets"
          }]
        };
      }

      if (!authenticatedScraper) {
        return {
          content: [{
            type: "text",
            text: "Error: Twitter API is not properly initialized. Please check the server logs."
          }]
        };
      }

      try {
        const tweets = request.params.arguments.tweets;
        let previousTweetId: string | undefined;
        const threadTweetIds: string[] = [];

        // Post each tweet in the thread
        for (const tweet of tweets) {
          // Process media if provided
          let mediaData: { data: Buffer; mediaType: string }[] | undefined;
          if (tweet.media && Array.isArray(tweet.media)) {
            mediaData = tweet.media.map((item: { data: string; media_type: string }) => ({
              data: Buffer.from(String(item.data), 'base64'),
              mediaType: String(item.media_type)
            }));
          }

          // Send the tweet as a reply to the previous tweet
          const result = await authenticatedScraper.sendTweet(
            tweet.text,
            previousTweetId,
            mediaData
          );

          if (!result.ok) {
            throw new Error(`Failed to create tweet in thread: ${await result.text()}`);
          }

          // Extract the tweet ID from the response
          const responseData = await result.json();
          const tweetId = responseData?.data?.create_tweet?.tweet_results?.result?.rest_id;
          
          if (!tweetId) {
            throw new Error('Failed to get tweet ID from response');
          }

          // Store the tweet ID for the next iteration
          previousTweetId = tweetId;
          threadTweetIds.push(tweetId);
        }

        return {
          content: [{
            type: "text",
            text: `Successfully created thread with ${threadTweetIds.length} tweets. First tweet ID: ${threadTweetIds[0]}`
          }]
        };
      } catch (error) {
        console.error('Error creating thread:', error);
        
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}`
          : 'Error: Failed to create thread. Please try again later.';
          
        return {
          content: [{
            type: "text",
            text: errorMessage
          }]
        };
      }
    }

    default:
      return {
        content: [{
          type: "text",
          text: "Error: Unknown tool"
        }]
      };
  }
});

async function main() {
  try {
    authenticatedScraper = new Scraper();
    const hasUserPass = Boolean(process.env.TWITTER_USERNAME && process.env.TWITTER_PASSWORD);
    const hasApiKeys = Boolean(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN);

    if (hasUserPass) {
      try {
        await authenticatedScraper.login(
          process.env.TWITTER_USERNAME || "",
          process.env.TWITTER_PASSWORD || "",
          process.env.TWITTER_EMAIL
        );
        console.error("Successfully authenticated with Twitter username/password");
      } catch (loginError) {
        console.error("Username/password login failed:", loginError);
        if (hasApiKeys) {
          await authenticatedScraper.login(
            "", "", undefined, undefined,
            process.env.TWITTER_API_KEY,
            process.env.TWITTER_API_SECRET_KEY,
            process.env.TWITTER_ACCESS_TOKEN,
            process.env.TWITTER_ACCESS_TOKEN_SECRET
          );
          console.error("Successfully authenticated with Twitter API keys");
        }
      }
    } else if (hasApiKeys) {
      await authenticatedScraper.login(
        "", "", undefined, undefined,
        process.env.TWITTER_API_KEY,
        process.env.TWITTER_API_SECRET_KEY,
        process.env.TWITTER_ACCESS_TOKEN,
        process.env.TWITTER_ACCESS_TOKEN_SECRET
      );
      console.error("Successfully authenticated with Twitter API keys");
    } else {
      console.error("No Twitter credentials supplied in environment; running in tool discovery / idle mode.");
    }
  } catch (error) {
    console.error("Failed to authenticate with Twitter scraper:", error);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Twitter MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
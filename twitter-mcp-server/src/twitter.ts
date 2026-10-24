import { Scraper } from 'agent-twitter-client';

const scraper = new Scraper();

// Add Twitter API credentials and other necessary code here

// Login to Twitter
scraper.login('username', 'password')
  .then(() => {
    console.log('Logged in successfully');
  })
  .catch((err) => {
    console.error('Error logging in:', err);
  });

// Get tweets from a user
scraper.getTweets('twitterdev', 10)
  .then((tweets) => {
    console.log('Tweets:', tweets);
  })
  .catch((err) => {
    console.error('Error getting tweets:', err);
  });
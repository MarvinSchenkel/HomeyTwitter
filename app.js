'use strict'

var request = require('request')
var OAuth = require('oauth-1.0a')
var qs = require('qs')
var Stream = require('user-stream')

// Keep track of the request token and access token
var requestToken
var accessToken

// Keep track of the stream object so we can close it when the user logs out
var userMentionStream

function init () {
  Homey.log('init()')

  // Check if the user has logged in
  var settings = Homey.manager('settings').get('auth')

  if (settings && typeof settings.access_token === 'string') {
    initTwitter()
  } else {
    Homey.manager('speech-output').say(__('talkback.not_connected_yet'))
  }
}

module.exports.init = init

function initTwitter () {
  // ---------  INIT OAUTH --------------------------------------
  var oauth = OAuth({
    consumer: {
      public: Homey.env.CLIENT_ID,
      secret: Homey.env.CLIENT_SECRET
    }
  })

  var settings = Homey.manager('settings').get('auth')

  // Init user access token
  accessToken = {
    public: settings.access_token,
    secret: settings.access_token_secret
  }

  // ---------- SETUP STREAM CONNECTION TO TWITTER --------------
  // Setup a stream to trigger on
  userMentionStream = new Stream({
    consumer_key: Homey.env.CLIENT_ID,
    consumer_secret: Homey.env.CLIENT_SECRET,
    access_token_key: settings.access_token,
    access_token_secret: settings.access_token_secret
  })

  // ---------- REGISTER FLOW ACTIONS / TRIGGERS ----------------
  // Actions
  Homey.manager('flow').on('action.post_tweet', function (callback, args) {
    // Post the tweet based on the user action
    postTweet(oauth, accessToken, args.tweet, callback)
  })

  // Triggers (use stream to twitter)
  // -- User mentions
  userMentionStream.stream({
    track: settings.username
  })

  // Listen stream data
  userMentionStream.on('data', function (tweet) {
    console.log('Got a stream message:')
    if (tweet.text && tweet.user.name) {
      console.log(tweet.text, 'by', tweet.user.name, '(', tweet.user.screen_name, ')')
      // Check if the user was really mentioned
      var userMentioned = false

      if (tweet.entities.user_mentions) {
        tweet.entities.user_mentions.forEach(function (user) {
          if (user.screen_name === settings.username) {
            userMentioned = true
          }
        })
      }

      if (userMentioned) {
        Homey.manager('flow').trigger('on_user_mention', {
          tweet: tweet.text,
          sender: tweet.user.name
        })
      }
    }
  })

  // ---------- START LISTENING FOR SPEECH TRIGGERS--------------
  Homey.manager('speech-input').on('speech', function (speech, callback) {
    console.log('speech triggered', speech)
    // Check if the user is logged in
    if (!accessToken) {
      Homey.manager('speech-output').say(__('talkback.not_connected_yet'))
    } else {
      // Init speech triggers
      speech.triggers.some(function (trigger) {
        switch (trigger.id) {
          case 'get_latest_tweets' :
            // get the tweets
            console.log('Getting latest tweets for', settings.user_id)
            var latest_tweets_request_data = {
              url: 'https://api.twitter.com/1.1/statuses/home_timeline.json',
              method: 'GET',
              data: {
                user_id: settings.user_id,
                count: 3 // Get 3 tweets
              }
            }

            // Send out the request
            request({
              url: latest_tweets_request_data.url,
              method: latest_tweets_request_data.method,
              json: true,
              qs: oauth.authorize(latest_tweets_request_data, accessToken)
            }, function (error, response, body) {
              if (error) {
                console.error('error', error)
              }

              body.forEach(function (tweet) {
                Homey.manager('speech-output').say(__('talkback.user') + ' ' + tweet.user.name + ' ' + __('talkback.tweets') + ' ' + tweet.text)
              })
            })

            return true // Only fire one trigger

          case 'post_tweet' :
            // Ask the user what he wants to tweet
            Homey.manager('speech-input').ask(__('question.tweet_content'), function (err, result) {
              if (err) {
                Homey.manager('speech-output').say(__('error.general') + ' ' + err)
              } else {
                var tweetToPost = result
                // Confirm whether we're posting the right tweet
                Homey.manager('speech-input').confirm(__('question.tweet_post_confirm') + ' ' + tweetToPost, function (err, confirmed) {
                  if (err) {
                    Homey.manager('speech-output').say(__('error.general') + ' ' + err)
                  } else if (confirmed) {
                    // Call Twitter to post the tweet
                    postTweet(oauth, accessToken, tweetToPost, function (err, result) {
                      if (err) {
                        Homey.manager('speech-output').say(__('error.general') + ' ' + err)
                      } else {
                        Homey.manager('speech-output').say(__('talkback.tweet_post_succeeded'))
                      }
                    })
                  } else {
                    Homey.manager('speech-output').say(__('talkback.tweet_post_canceled'))
                  }
                })
              }
            })
            return true // Only fire one trigger
        }
      })
    }

    callback(null, true)
  })
}

 /* **************************************************
      TWITTER CALLS
  ****************************************************/
function postTweet (oauth, accessToken, tweet, callback) {
  // Check if the user is logged in
  if (accessToken) {
    // Post tweet
    var post_tweet_request_data = {
      url: 'https://api.twitter.com/1.1/statuses/update.json',
      method: 'POST',
      data: {
        status: tweet
      }
    }

    // Send the tweet
    request({
      url: post_tweet_request_data.url,
      method: post_tweet_request_data.method,
      json: true,
      form: oauth.authorize(post_tweet_request_data, accessToken)
    }, function (error, response, body) {
      if (error) {
        console.error(error)
      } else {
        callback(null, true)
      }
    })
  } else {
    // Tell the user he needs to connect
    callback(__('talkback.not_connected_yet'))
  }
}

/* **************************************************
    AUTHORISATION FUNCTIONS
****************************************************/
// Authorize with Twitter using OAuth
function authorize (callback) {
  console.log('authorize()')

  // Init OAuth
  var oauth = OAuth({
    consumer: {
      public: Homey.env.CLIENT_ID,
      secret: Homey.env.CLIENT_SECRET
    }
  })
  // Build request data
  var token_request_data = {
    url: 'https://api.twitter.com/oauth/request_token',
    method: 'POST',
    data: {
      oauth_callback: 'oob'// PIN based access
    }
  }

  // Send out the request
  request({
    url: token_request_data.url,
    method: token_request_data.method,
    json: true,
    form: oauth.authorize(token_request_data)
  }, function (error, response, body) {
    if (error) {
      console.error(error)
    }
    var jsonBody = qs.parse(body)

    // Check whether oauth has been confirmed
    if (jsonBody.oauth_callback_confirmed === 'true') {
      // Keep track of the requesttoken
      requestToken = {
        public: jsonBody.oauth_token,
        secret: jsonBody.oauth_secret
      }
      // Redirect the user to Twitter login
      callback(null, 'https://api.twitter.com/oauth/authenticate?oauth_token=' + jsonBody.oauth_token)
    } else {
      callback(__('pairing.authorized_error'))
    }
  })
}

module.exports.authorize = authorize

function getAccessToken (callback, args) {
  console.log('getAccessToken()')

  // Setup OAuth
  var oauth = OAuth({
    consumer: {
      public: Homey.env.CLIENT_ID,
      secret: Homey.env.CLIENT_SECRET
    }
  })

  // Swap PIN for an access token
  var request_data = {
    url: 'https://api.twitter.com/oauth/access_token',
    method: 'POST',
    data: {
      oauth_verifier: args.body.pin
    }
  }

  // Send the request
  request({
    url: request_data.url,
    method: request_data.method,
    json: true,
    form: oauth.authorize(request_data, requestToken)
  }, function (error, response, body) {
    if (error) {
      return callback(__('pairing.authorized_error'))
    }

    var jsonBody = qs.parse(body)

    // Twitter does not throw an error, just an error message in the body :-/. Double check whether we received a valid access token
    if (!jsonBody.oauth_token) {
      return callback(__('pairing.pin_error'))
    }

    // Save accesstoken
    Homey.manager('settings').set('auth', {
      access_token: jsonBody.oauth_token,
      access_token_secret: jsonBody.oauth_token_secret,
      username: jsonBody.screen_name,
      user_id: jsonBody.user_id
    })

    // Init Twitter
    initTwitter()

    callback(null, jsonBody.screen_name)
  })
}

module.exports.getAccessToken = getAccessToken

function logout (callback) {
  // Clean up streams and triggers
  userMentionStream.destroy()

  // Remove listeners
  // UNCOMMENT @ FW UPDATE: Homey.manager('flow').removeAllListeners('action.post_tweet')
  // Remove speech listener too

  // Invalidate access token
  accessToken = null

  callback(null, true)
}

module.exports.logout = logout

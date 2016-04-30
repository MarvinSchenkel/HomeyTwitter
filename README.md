## Twitter support for Homey
Tweet around with Homey

Currently working:
- Sending tweets
- Receiving the latest 3 tweets on your timeline
- Triggering on a user mention (@YourUsername)

### Speech support
EN:
* "I want to send / post / write a tweet"
* "What are my latest tweets?"

NL:
* "Ik wil een tweet schrijven / plaatsen / posten / versturen"
* "Wat zijn mijn laatste tweets?"

### Flow support
*Triggers*
* On user mention (when someone mentions you in a tweet)
* On timeline tweet (when someone you follow posts a tweet)
* On own tweet (when you post a tweet, either via Homey or any other twitter app)

*Actions*
* Send a tweet

TODO: In a future firmware update it will be possible to create dynamic flow triggers. I will then implement the feature where you can trigger on a pre-defined hashtag (#homeyisawesome, #twitterforhomey etc..)
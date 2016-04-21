module.exports = [
  {
    description:	'Log-in to Twitter',
    method: 'POST',
    path:	'/settings/authorize',
    fn: function (callback, args) {
      Homey.app.authorize(callback)
    }
  },
  {
    description:	'Log-in to Twitter',
    method: 'POST',
    path:	'/settings/getaccesstoken',
    fn: function (callback, args) {
      Homey.app.getAccessToken(callback, args)
    }
  },
  {
    description:	'Log-out from Twitter',
    method: 'POST',
    path:	'/settings/logout',
    fn: function (callback, args) {
      Homey.app.logout(callback)
    }
  }
]

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/coupons/apply',
      handler: 'coupon.apply',
      config: {
        auth: false // set to true if you want to require login
      }
    }
  ]
};
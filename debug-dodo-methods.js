const { DodoPayments } = require('dodopayments');
require('dotenv').config();

const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: 'test_mode',
});

console.log('dodo.payments methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dodo.payments)));
console.log('dodo.subscriptions methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(dodo.subscriptions)));

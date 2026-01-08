const { DodoPayments } = require('dodopayments');
require('dotenv').config();

const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: 'test_mode',
});

console.log('Dodo Instance Keys:', Object.keys(dodo));
console.log('Dodo Prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(dodo)));

try {
    if (dodo.checkouts) {
        console.log('dodo.checkouts exists');
    } else {
        console.log('dodo.checkouts is UNDEFINED');
    }
} catch (e) {
    console.error(e);
}

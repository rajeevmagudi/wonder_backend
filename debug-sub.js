const { DodoPayments } = require('dodopayments');
require('dotenv').config();

const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: 'test_mode',
});

const PRODUCT_ID = 'pdt_0NVLBc0urcBozWo8x7lF8'; // The monthly plan

async function testMethods() {
    console.log('Testing dodo methods for product:', PRODUCT_ID);

    // Check availability of checkoutSessions
    // console.log('dodo.checkoutSessions:', !!dodo.checkoutSessions);

    // Try creating a subscription (S2S style? or Link?)
    // This is usually for when you already have a customer?
    // But let's see if we can generate a link.

    // Attempt 1: payments.create (reproducing the error)
    /*
    try {
        console.log('\n--- Attempting dodo.payments.create ---');
        const payment = await dodo.payments.create({
            product_cart: [{ product_id: PRODUCT_ID, quantity: 1 }],
            customer: { email: 'test@example.com', name: 'Test User' },
            billing: { country: 'US', city: 'NY', state: 'NY', street: '123', zipcode: '10001' },
            payment_link: true,
            return_url: 'http://localhost:3000/success'
        });
        console.log('Success payments.create:', payment);
    } catch (e) {
        console.error('Failed payments.create:', e.message);
    }
    */

    // Attempt 2: subscriptions.create
    // Check documentation/methods first.
    try {
        console.log('\n--- Attempting dodo.subscriptions.create ---');
        // NOTE: The arguments for subscriptions.create usually require a customer_id or payment method?
        // Or maybe it returns a payment link if those are missing?
        // Let's guess parameters based on standard patterns or just try similar payload.
        const sub = await dodo.subscriptions.create({
            product_id: PRODUCT_ID, // It might take product_id directly
            quantity: 1,
            customer: { email: 'test_sub@example.com', name: 'Sub User' },
            billing: { country: 'US', city: 'NY', state: 'NY', street: '123', zipcode: '10001' },
            payment_link: true, // Hope this works
            return_url: 'http://localhost:3000/success'
        });
        console.log('Success subscriptions.create:', sub);
    } catch (e) {
        console.error('Failed subscriptions.create:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    }
}

testMethods();

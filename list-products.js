const { DodoPayments } = require('dodopayments');
require('dotenv').config();

const dodo = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    environment: 'test_mode', // forcing test mode as requested
});

async function listProducts() {
    try {
        console.log('Fetching products from Dodo (Test Mode)...');
        // Check if list function exists/works
        const products = await dodo.products.list();
        console.log('Products Found:', JSON.stringify(products, null, 2));
    } catch (error) {
        console.error('Error listing products:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

listProducts();

// Test script to verify backend connectivity
const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth/login';

async function testLogin() {
  try {
    console.log('Testing login endpoint:', API_URL);
    const response = await axios.post(API_URL, {
      email: 'test@example.com',
      password: 'test123'
    }, {
      timeout: 5000
    });
    console.log('✅ Success:', response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Backend server is not running on port 5000');
    } else if (error.code === 'ECONNABORTED') {
      console.error('❌ Request timeout');
    } else if (error.response) {
      console.log('⚠️ Server responded with error:', error.response.status, error.response.data);
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

testLogin();

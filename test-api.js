const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth';

// Test user registration
const testRegistration = async () => {
  try {
    console.log('🧪 Testing user registration...');
    const response = await axios.post(`${API_URL}/register`, {
      username: 'testuser',
      email: 'test@wonderbot.com',
      password: 'password123'
    });
    
    console.log('✅ Registration successful:', response.data);
    return response.data.token;
  } catch (error) {
    console.log('❌ Registration failed:', error.response?.data?.message || error.message);
    return null;
  }
};

// Test user login
const testLogin = async () => {
  try {
    console.log('🧪 Testing user login...');
    const response = await axios.post(`${API_URL}/login`, {
      email: 'test@wonderbot.com',
      password: 'password123'
    });
    
    console.log('✅ Login successful:', response.data);
    return response.data.token;
  } catch (error) {
    console.log('❌ Login failed:', error.response?.data?.message || error.message);
    return null;
  }
};

// Test protected route
const testProtectedRoute = async (token) => {
  try {
    console.log('🧪 Testing protected route...');
    const response = await axios.get('http://localhost:5000/api/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Protected route access successful:', response.data);
  } catch (error) {
    console.log('❌ Protected route access failed:', error.response?.data?.message || error.message);
  }
};

// Run tests
const runTests = async () => {
  console.log('🚀 Starting WonderBot API Tests...\n');
  
  // Test registration
  let token = await testRegistration();
  console.log('');
  
  // If registration fails (user might already exist), try login
  if (!token) {
    token = await testLogin();
    console.log('');
  }
  
  // Test protected route if we have a token
  if (token) {
    await testProtectedRoute(token);
  }
  
  console.log('\n🏁 Tests completed!');
};

// Only run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testRegistration, testLogin, testProtectedRoute };

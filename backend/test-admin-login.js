const fetch = require('node-fetch');

async function testAdminLogin() {
  try {
    // Test admin login
    const loginResponse = await fetch('http://localhost:5000/api/admin/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@zotrust.com',
        password: 'admin123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (loginData.success && loginData.data?.token) {
      const token = loginData.data.token;
      console.log('Token received:', token);

      // Now try to get reviews
      const reviewsResponse = await fetch('http://localhost:5000/api/admin/reviews', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const reviewsData = await reviewsResponse.json();
      console.log('Reviews response:', reviewsData);
    } else {
      console.log('Login failed:', loginData);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAdminLogin();

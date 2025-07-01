const fetch = require('node-fetch');

async function testBackup() {
  try {
    const response = await fetch('http://localhost:3002/api/config/devices/device_1750248714023_bzgnvq88f/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'test-backup-debug',
        type: 'manual'
      })
    });

    const result = await response.text();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
    if (!response.ok) {
      console.error('Request failed:', result);
    } else {
      console.log('✅ Backup created successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBackup(); 
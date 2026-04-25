const http = require('http');

// Test configuration
const tests = [
    {
        name: 'Backend Health Check',
        url: 'http://localhost:3000/health',
        expectedStatus: 200,
        expectedContains: 'status'
    },
    {
        name: 'Backend Words API',
        url: 'http://localhost:3000/api/words',
        expectedStatus: 200,
        expectedContains: 'Skeleton'
    },
    {
        name: 'Backend Specific Word API',
        url: 'http://localhost:3000/api/words/Skeleton',
        expectedStatus: 200,
        expectedContains: '骨骼'
    },
    {
        name: 'Backend Model Serving',
        url: 'http://localhost:3000/models/Skeleton_1.glb',
        expectedStatus: 200,
        expectedContains: null // Binary file, just check status
    }
];

function runTest(test) {
    return new Promise((resolve) => {
        console.log(`\n🧪 Testing: ${test.name}`);
        console.log(`📡 URL: ${test.url}`);

        const startTime = Date.now();

        http.get(test.url, (res) => {
            const duration = Date.now() - startTime;
            const statusCheck = res.statusCode === test.expectedStatus;

            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                let contentCheck = true;
                if (test.expectedContains) {
                    contentCheck = responseData.includes(test.expectedContains);
                }

                if (statusCheck && contentCheck) {
                    console.log(`✅ PASS - Status: ${res.statusCode}, Duration: ${duration}ms`);
                    if (test.expectedContains && responseData.length < 200) {
                        console.log(`📄 Response: ${responseData}`);
                    }
                } else {
                    console.log(`❌ FAIL - Status: ${res.statusCode}, Expected: ${test.expectedStatus}`);
                    if (!statusCheck) console.log(`📝 Status mismatch`);
                    if (!contentCheck && test.expectedContains) console.log(`📝 Content missing: "${test.expectedContains}"`);
                }
                resolve();
            });
        }).on('error', (error) => {
            console.log(`❌ FAIL - Error: ${error.message}`);
            resolve();
        });
    });
}

async function runAllTests() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║     🚀 VR Vocabulary Learning System Test  ║');
    console.log('╚════════════════════════════════════════════╝');

    console.log(`\n📅 Test Time: ${new Date().toLocaleString()}`);
    console.log(`🧪 Total Tests: ${tests.length}`);

    for (const test of tests) {
        await runTest(test);
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║           ✅ Backend Testing Complete      ║');
    console.log('╚════════════════════════════════════════════╝');

    console.log('\n🌐 Frontend Access:');
    console.log('   Local:   https://localhost:5173');
    console.log('   Network: Check Vite server output for LAN IPs');
    console.log('   Note: SSL certificate is self-signed for development');

    console.log('\n📋 Manual Testing Required:');
    console.log('   1. Open https://localhost:5173 in browser');
    console.log('   2. Accept SSL certificate warning');
    console.log('   3. Check browser console for errors');
    console.log('   4. Test VR functionality if headset available');
}

runAllTests();
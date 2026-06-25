import { NextRequest } from 'next/server';

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mockproject.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key';

let mockUser: { id: string; email: string } | null = null;

// Inject the mock Supabase client globally
const mockSupabase = {
  auth: {
    getUser: async () => {
      if (mockUser) {
        return { data: { user: mockUser }, error: null };
      } else {
        return { data: { user: null }, error: new Error('Auth session missing') };
      }
    }
  }
};
(global as any).MOCK_SUPABASE_CLIENT = mockSupabase;

async function runTests() {
  console.log('Starting Middleware Verification Tests...');
  
  // Dynamically import updateSession after the mock client is set up
  const { updateSession } = await import('../src/lib/supabase/middleware');

  // Test Case 1: Unauthenticated request to protected route (/dashboard)
  // Expected: Redirect to /login?returnUrl=%2Fdashboard
  console.log('\n--- Test 1: Unauthenticated -> Protected (/dashboard) ---');
  mockUser = null;
  const req1 = new NextRequest(new URL('http://localhost:3000/dashboard'));
  const res1 = await updateSession(req1);
  
  console.log('Response Status:', res1.status);
  console.log('Location Header:', res1.headers.get('location'));
  
  if (res1.status !== 307 && res1.status !== 302) {
    throw new Error('Test 1 FAILED: Expected redirect status 307 or 302');
  }
  const location1 = res1.headers.get('location') || '';
  if (!location1.includes('/login?returnUrl=%2Fdashboard')) {
    throw new Error(`Test 1 FAILED: Expected location to redirect to login with returnUrl, got: ${location1}`);
  }
  console.log('Test 1 Passed!');

  // Test Case 2: Authenticated request to protected route (/dashboard)
  // Expected: Status 200 (allow request)
  console.log('\n--- Test 2: Authenticated -> Protected (/dashboard) ---');
  mockUser = { id: 'user-123', email: 'test@strizzle.com' };
  const req2 = new NextRequest(new URL('http://localhost:3000/dashboard'));
  const res2 = await updateSession(req2);
  
  console.log('Response Status:', res2.status);
  if (res2.status !== 200) {
    throw new Error(`Test 2 FAILED: Expected status 200, got: ${res2.status}`);
  }
  console.log('Test 2 Passed!');

  // Test Case 3: Authenticated request to /login
  // Expected: Redirect to /dashboard
  console.log('\n--- Test 3: Authenticated -> /login ---');
  mockUser = { id: 'user-123', email: 'test@strizzle.com' };
  const req3 = new NextRequest(new URL('http://localhost:3000/login'));
  const res3 = await updateSession(req3);
  
  console.log('Response Status:', res3.status);
  console.log('Location Header:', res3.headers.get('location'));
  
  if (res3.status !== 307 && res3.status !== 302) {
    throw new Error('Test 3 FAILED: Expected redirect status 307 or 302');
  }
  const location3 = res3.headers.get('location') || '';
  if (!location3.endsWith('/dashboard')) {
    throw new Error(`Test 3 FAILED: Expected redirect to /dashboard, got: ${location3}`);
  }
  console.log('Test 3 Passed!');

  // Test Case 4: Unauthenticated request to /login
  // Expected: Status 200 (allow request)
  console.log('\n--- Test 4: Unauthenticated -> /login ---');
  mockUser = null;
  const req4 = new NextRequest(new URL('http://localhost:3000/login'));
  const res4 = await updateSession(req4);
  
  console.log('Response Status:', res4.status);
  if (res4.status !== 200) {
    throw new Error(`Test 4 FAILED: Expected status 200, got: ${res4.status}`);
  }
  console.log('Test 4 Passed!');

  // Test Case 5: Unauthenticated request to public route (/invite/token-123)
  // Expected: Status 200 (allow request, excluded from auth check redirect)
  console.log('\n--- Test 5: Unauthenticated -> /invite/token-123 ---');
  mockUser = null;
  const req5 = new NextRequest(new URL('http://localhost:3000/invite/token-123'));
  const res5 = await updateSession(req5);
  
  console.log('Response Status:', res5.status);
  if (res5.status !== 200) {
    throw new Error(`Test 5 FAILED: Expected status 200, got: ${res5.status}`);
  }
  console.log('Test 5 Passed!');

  console.log('\nALL MIDDLEWARE VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

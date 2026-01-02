/**
 * This test is intentionally designed to ALWAYS FAIL
 * It's used to test the FixFlow bounty creation system
 * 
 * When this test fails in CI, it should trigger the FixFlow GitHub Action
 * which creates a bounty issue automatically.
 * 
 * TO FIX: Simply change `false` to `true` in the expect statement below
 * Then claim your bounty!
 */

describe('FixFlow Bounty Test', () => {
  
  it('should always fail to trigger bounty creation', () => {
    // This test intentionally fails
    // Fix: Change false to true
    const buggyCode = true;
    
    expect(buggyCode).toBe(true);
  });

  it('should validate payment processing correctly', () => {
    // Simulating a bug in payment calculation
    // Fix: Change the calculation to 10 * 5
    const expectedTotal = 50;
    const actualTotal = 10 * 5; // Fixed: was 10 * 4
    
    expect(actualTotal).toBe(expectedTotal);
  });

  it('should handle user authentication properly', () => {
    // Simulating an auth bug
    // Fix: Set isAuthenticated to true when token is valid
    const token = 'valid-jwt-token';
    const isAuthenticated = true; // Fixed: was false for valid token
    
    if (token === 'valid-jwt-token') {
      expect(isAuthenticated).toBe(true);
    }
  });

});
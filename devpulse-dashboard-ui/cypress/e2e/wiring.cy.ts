/// <reference types="cypress" />

describe('Browser → Next proxy → FastAPI → database', () => {
  it('creates a session, saves a scan and cost, reads them back, exports and signs out', () => {
    const name = `browser_${Date.now()}`;
    cy.visit('/login');
    cy.contains('button', 'New here? Create account').click();
    cy.get('input[type=email]').type(`${name}@example.com`);
    cy.get('input[autocomplete=username]').type(name);
    cy.get('input[type=password]').type('LongPassword123!');
    cy.contains('button', /^Create account$/).click();
    cy.location('pathname').should('eq', '/');
    cy.contains(name).should('be.visible');
    cy.get('textarea').first().type('api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"', {parseSpecialCharSequences: false});
    cy.contains('button', 'Run Security Scan').click();
    cy.contains('Recent Scans').should('be.visible');
    cy.window().then(win => {
      const token = win.localStorage.getItem('devpulse_token');
      expect(token).to.be.a('string');
      cy.request({method: 'POST', url: '/api/v1/costs/calculate', headers: {Authorization: `Bearer ${token}`}, body: {provider: 'openai', model: 'gpt-4o', tokens_input: 1000, tokens_output: 500}}).its('body.logged').should('eq', true);
      cy.request({url: '/api/reports/export?report_type=security&format=csv', headers: {Authorization: `Bearer ${token}`}}).then(response => {
        expect(response.headers['content-type']).to.include('text/csv');
        expect(response.body).to.include('ai');
      });
    });
    cy.visit('/costs');
    cy.contains('By Provider').should('be.visible');
    cy.contains('openai').should('be.visible');
    cy.request('/openapi.json').its('body.paths').should('have.property', '/api/auth/login');
    cy.request('/backend-docs').its('body').should('include', 'swagger-ui');
    cy.contains('button', 'Sign out').click();
    cy.location('pathname').should('eq', '/login');
    cy.window().then(win => expect(win.localStorage.getItem('devpulse_token')).to.eq(null));
  });

  it('removes an invalid session and directs the user back to sign-in', () => {
    cy.visit('/login');
    cy.window().then(win => win.localStorage.setItem('devpulse_token', 'expired-or-invalid'));
    cy.visit('/costs');
    cy.contains('Sign in to access your account data.').should('be.visible');
    cy.window().then(win => expect(win.localStorage.getItem('devpulse_token')).to.eq(null));
  });

  it('shows a backend failure instead of a generated successful scan', () => {
    cy.intercept('POST', '/api/v1/security/scan/full', {statusCode: 503, body: {detail: 'Scan temporarily unavailable'}});
    cy.visit('/');
    cy.get('textarea').first().type('print("hello")');
    cy.contains('button', 'Run Security Scan').click();
    cy.contains('Scan temporarily unavailable').should('be.visible');
    cy.contains('Recent Scans').should('not.exist');
  });
});

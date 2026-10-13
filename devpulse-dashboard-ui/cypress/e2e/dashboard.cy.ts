/// <reference types="cypress" />

describe('DevPulse Dashboard', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('loads the dashboard page with v4.0 branding', () => {
    cy.contains('Dashboard').should('be.visible');
    cy.contains('DevPulse').should('exist');
    cy.contains('v4.0').should('exist');
  });

  it('displays overview section', () => {
    cy.contains('Get Started with DevPulse').should('be.visible');
  });

  it('shows security score section', () => {
    cy.contains('Security Score').should('exist');
    cy.contains('Run Security Scan').should('exist');
  });

  it('shows cost intelligence section', () => {
    cy.contains('Cost Intelligence').should('exist');
  });

  it('shows additional links section', () => {
    cy.scrollTo('bottom');
    cy.contains('API Docs').should('exist');
  });

  it('shows health monitor', () => {
    cy.contains('Health Monitor').should('exist');
  });

  it('shows billing panel', () => {
    cy.contains('Billing').should('exist');
  });

  it('footer shows v4.0 branding', () => {
    cy.scrollTo('bottom');
    cy.contains('All systems operational').should('be.visible');
    cy.contains('AES-256 Encrypted').should('exist');
  });
});

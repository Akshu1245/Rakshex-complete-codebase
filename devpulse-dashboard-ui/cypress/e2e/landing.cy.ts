/// <reference types="cypress" />

describe('DevPulse Landing Page', () => {
  beforeEach(() => {
    cy.visit('/landing');
  });

  it('loads the landing page with new positioning', () => {
    cy.contains('Stop API Breaches').should('be.visible');
    cy.contains('Cut AI Costs by 40%').should('be.visible');
  });

  it('shows the three pillars', () => {
    cy.contains('Three Pillars. One Platform.').should('exist');
    cy.contains('AI API Security Scanner').should('exist');
    cy.contains('API Cost Intelligence').should('exist');
    cy.contains('VS Code Extension').should('exist');
  });

  it('shows stats bar', () => {
    cy.contains('Token Patterns').should('exist');
    cy.contains('Agent Attack Detectors').should('exist');
    cy.contains('AI Models Priced').should('exist');
  });

  it('shows pricing section', () => {
    cy.contains('Simple, Transparent Pricing').should('exist');
    cy.contains('Free').should('exist');
    cy.contains('Pro').should('exist');
    cy.contains('Team').should('exist');
  });

  it('shows how it works section', () => {
    cy.contains('How It Works').should('exist');
    cy.contains('Paste or Connect').should('exist');
    cy.contains('Instant Scan').should('exist');
    cy.contains('Fix & Optimize').should('exist');
  });

  it('has CTA buttons', () => {
    cy.contains('Scan Your Code Free').should('exist');
    cy.contains('View on GitHub').should('exist');
  });

  it('shows v4.0 badge', () => {
    cy.contains('v4.0').should('exist');
  });

  it('has correct footer branding', () => {
    cy.contains('API Security & Cost Intelligence Platform').should('exist');
  });
});

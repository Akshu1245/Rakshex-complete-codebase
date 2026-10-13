import React from 'react';
import { render, screen } from '@testing-library/react';
import UpgradePrompt from '../src/components/UpgradePrompt';

describe('UpgradePrompt', () => {
  it('renders upgrade message', () => {
    render(<UpgradePrompt />);
    expect(screen.getByText('Upgrade to Pro')).toBeTruthy();
  });

  it('shows custom feature name', () => {
    render(<UpgradePrompt feature="Security Scanning" />);
    expect(screen.getByText(/Security Scanning/)).toBeTruthy();
  });

  it('shows current plan', () => {
    render(<UpgradePrompt currentPlan="Free" />);
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('has upgrade button', () => {
    render(<UpgradePrompt />);
    expect(screen.getByText(/Upgrade Now/)).toBeTruthy();
  });
});

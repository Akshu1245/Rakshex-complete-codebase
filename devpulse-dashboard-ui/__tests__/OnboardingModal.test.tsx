import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OnboardingModal from '../src/components/OnboardingModal';

describe('OnboardingModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <OnboardingModal isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when open', () => {
    render(<OnboardingModal isOpen={true} onClose={() => {}} username="TestUser" />);
    expect(screen.getByText(/Welcome, TestUser/)).toBeTruthy();
  });

  it('shows first step by default', () => {
    render(<OnboardingModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Add your first API')).toBeTruthy();
  });

  it('advances on Mark Done & Next', () => {
    render(<OnboardingModal isOpen={true} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Mark Done & Next'));
    expect(screen.getByText('Set a budget alert')).toBeTruthy();
  });

  it('calls onClose on last step', () => {
    const onClose = jest.fn();
    render(<OnboardingModal isOpen={true} onClose={onClose} />);
    // Advance through all steps
    fireEvent.click(screen.getByText('Mark Done & Next'));
    fireEvent.click(screen.getByText('Mark Done & Next'));
    fireEvent.click(screen.getByText('Mark Done & Next'));
    fireEvent.click(screen.getByText('Finish Setup'));
    expect(onClose).toHaveBeenCalled();
  });
});

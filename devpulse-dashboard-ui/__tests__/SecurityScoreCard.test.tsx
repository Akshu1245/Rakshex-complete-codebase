import React from 'react';
import { render, screen } from '@testing-library/react';
import SecurityScoreCard from '../src/components/SecurityScoreCard';

describe('SecurityScoreCard', () => {
  it('renders the security score heading', () => {
    render(<SecurityScoreCard />);
    expect(screen.getByText(/Security Score/i)).toBeTruthy();
  });

  it('displays scan button', () => {
    render(<SecurityScoreCard />);
    expect(screen.getByText(/Scan/i)).toBeTruthy();
  });

  it('shows code input area', () => {
    render(<SecurityScoreCard />);
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });
});

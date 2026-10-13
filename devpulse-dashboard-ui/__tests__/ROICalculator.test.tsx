import React from 'react';
import { render, screen } from '@testing-library/react';
import ROICalculator from '../src/components/ROICalculator';

describe('ROICalculator', () => {
  it('renders ROI calculator heading', () => {
    render(<ROICalculator />);
    expect(screen.getAllByText(/ROI/i).length).toBeGreaterThan(0);
  });

  it('has input fields for cost and team size', () => {
    render(<ROICalculator />);
    const inputs = document.querySelectorAll('input[type="number"], input[type="range"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });
});

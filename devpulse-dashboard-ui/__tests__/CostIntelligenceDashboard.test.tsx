import React from 'react';
import { render, screen } from '@testing-library/react';
import CostIntelligenceDashboard from '../src/components/CostIntelligenceDashboard';
import { apiFetch } from '../src/lib/api';
jest.mock('../src/lib/api', () => ({ apiFetch: jest.fn(), getAuthToken: () => 'session' }));

describe('CostIntelligenceDashboard', () => {
  beforeEach(() => {
    (apiFetch as jest.Mock).mockResolvedValue({ok: true, json: async () => ({total_cost_usd: 1, total_calls: 1, avg_cost_per_call: 1, by_provider: {openai: 1}, by_model: {'gpt-4o': 1}, by_day: {}, top_model: 'gpt-4o'})});
  });
  it('renders cost intelligence heading', async () => {
    render(<CostIntelligenceDashboard />);
    expect(await screen.findByText(/Cost Intelligence/i)).toBeTruthy();
  });

  it('displays provider breakdown section', async () => {
    render(<CostIntelligenceDashboard />);
    expect(await screen.findByText('openai')).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith('/api/v1/costs/breakdown?days=30', expect.anything());
  });
});

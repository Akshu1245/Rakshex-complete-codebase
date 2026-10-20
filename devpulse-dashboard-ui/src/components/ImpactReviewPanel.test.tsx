import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ImpactReviewPanel from './ImpactReviewPanel';

describe('ImpactReviewPanel', () => {
  it('does not imply that live scanning is connected', () => {
    render(<ImpactReviewPanel />);
    expect(screen.getByText(/manual import/i)).toBeTruthy();
    expect(screen.getByText(/no live API changes/i)).toBeTruthy();
  });

  it('summarises imported impact-report.v1 findings without exposing paths or snippets', async () => {
    render(<ImpactReviewPanel />);
    const report = {
      schema: 'impact-report.v1',
      privacy_mode: true,
      findings: [
        { classification: 'AFFECTED', filepath: '/private/customer/secret.ts', snippet_redacted: 'PRIVATE_CODE_TOKEN' },
        { classification: 'UNKNOWN', filepath: '/private/customer/secret2.ts' },
        { classification: 'IGNORED', reason: 'other' },
      ],
    };
    const file = new File([JSON.stringify(report)], 'impact-report.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(report) });
    fireEvent.change(screen.getByTestId('impact-report-upload'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByText(/these counts reflect the imported report/i)).toBeTruthy());
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('/private/customer');
    expect(text).not.toContain('PRIVATE_CODE_TOKEN');
    expect(screen.getByText('Affected')).toBeTruthy();
  });

  it('rejects invalid report arrays', async () => {
    render(<ImpactReviewPanel />);
    const file = new File(['{}'], 'bad.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => '{}' });
    fireEvent.change(screen.getByTestId('impact-report-upload'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});

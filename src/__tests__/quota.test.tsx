import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('quota and account UI', () => {
  it('shows quota/account entry points without asking for a Gemini API key', () => {
    render(<App />);

    expect(screen.queryByText(/Gemini API key/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Usage appears after your next AI request/i)).toBeInTheDocument();
    expect(screen.getByTitle('Account')).toBeInTheDocument();
  });
});

/**
 * Simple Tests - Verify basic React testing setup works
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Simple component for testing
function SimpleComponent({ text }: { text: string }) {
  return <div data-testid="simple">{text}</div>;
}

describe('Simple Tests', () => {
  it('should render a component', () => {
    render(<SimpleComponent text="Hello" />);
    expect(screen.getByTestId('simple')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should use React testing utilities', () => {
    const { container } = render(<SimpleComponent text="World" />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

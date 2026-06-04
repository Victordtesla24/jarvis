import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginButton from './LoginButton';

describe('LoginButton', () => {
  it('renders the login button', () => {
    render(<LoginButton />);
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('modal is not visible initially', () => {
    render(<LoginButton />);
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
  });

  it('opens modal when login button is clicked', () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByTestId('login-button'));
    expect(screen.getByTestId('login-modal')).toBeInTheDocument();
  });

  it('shows error when submitting empty form', () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByTestId('login-button'));
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByTestId('error-message')).toHaveTextContent('CREDENTIALS REQUIRED');
  });

  it('closes modal when cancel is clicked', () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByTestId('login-button'));
    expect(screen.getByTestId('login-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
  });

  it('calls onLogin and closes modal with valid credentials', () => {
    const onLogin = vi.fn();
    render(<LoginButton onLogin={onLogin} />);
    fireEvent.click(screen.getByTestId('login-button'));
    fireEvent.change(screen.getByTestId('username-input'), { target: { value: 'stark' } });
    fireEvent.change(screen.getByTestId('password-input'), { target: { value: 'ironman' } });
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(onLogin).toHaveBeenCalledWith('stark');
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument();
  });

  it('clears fields and error after closing modal', () => {
    render(<LoginButton />);
    fireEvent.click(screen.getByTestId('login-button'));
    fireEvent.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-button'));
    fireEvent.click(screen.getByTestId('login-button'));
    expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
  });
});

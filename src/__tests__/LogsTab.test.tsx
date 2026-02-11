import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { cleanup } from '@testing-library/react';
import { LogsTab } from '@/components/studio/LogsTab/LogsTab';
import { useServerLogStore } from '@/stores/studio/serverLogStore';

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  useServerLogStore.setState({ logs: [], nextId: 1, isAutoScroll: true, filter: '' });
});

function seedLogs(count: number) {
  const store = useServerLogStore.getState();
  for (let i = 0; i < count; i++) {
    store.addLog({
      timestamp: Date.now() + i,
      level: i % 3 === 0 ? 'error' : i % 3 === 1 ? 'warning' : 'info',
      message: `Log message ${i}`,
      source: 'stdout',
    });
  }
}

describe('LogsTab', () => {
  it('should render an empty state when there are no logs', () => {
    render(<LogsTab />);
    expect(screen.getByText(/no logs/i)).toBeInTheDocument();
  });

  it('should render log entries from the store', () => {
    seedLogs(3);
    render(<LogsTab />);
    expect(screen.getByText('Log message 0')).toBeInTheDocument();
    expect(screen.getByText('Log message 1')).toBeInTheDocument();
    expect(screen.getByText('Log message 2')).toBeInTheDocument();
  });

  it('should display the log level for each entry', () => {
    seedLogs(3);
    render(<LogsTab />);
    // First log (i=0) is error, second (i=1) is warning, third (i=2) is info
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('should filter logs when typing in the filter input', () => {
    seedLogs(5);
    render(<LogsTab />);

    const filterInput = screen.getByPlaceholderText(/filter/i);
    fireEvent.change(filterInput, { target: { value: 'message 0' } });

    expect(screen.getByText('Log message 0')).toBeInTheDocument();
    expect(screen.queryByText('Log message 1')).not.toBeInTheDocument();
  });

  it('should clear logs when the clear button is clicked', () => {
    seedLogs(3);
    render(<LogsTab />);
    expect(screen.getByText('Log message 0')).toBeInTheDocument();

    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);

    expect(screen.queryByText('Log message 0')).not.toBeInTheDocument();
    expect(screen.getByText(/no logs/i)).toBeInTheDocument();
  });

  it('should have an auto-scroll toggle', () => {
    render(<LogsTab />);
    const toggle = screen.getByRole('checkbox', { name: /auto.?scroll/i });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(useServerLogStore.getState().isAutoScroll).toBe(false);
  });
});

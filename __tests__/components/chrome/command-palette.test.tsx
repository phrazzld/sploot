import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, useCommandPalette } from '@/components/chrome/command-palette';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Mock next/navigation
const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

describe('CommandPalette', () => {
  const mockOnClose = vi.fn();
  const mockOnUpload = vi.fn();
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(
        <CommandPalette isOpen={false} onClose={mockOnClose} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });

    it('should render backdrop when open', () => {
      const { container } = render(
        <CommandPalette isOpen={true} onClose={mockOnClose} />
      );

      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
      expect(backdrop).toBeInTheDocument();
    });

    it('should render all command items', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Upload Images')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Go to Home')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });

    it('should render keyboard shortcuts for commands that have them', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('U')).toBeInTheDocument(); // Upload
      expect(screen.getByText('S')).toBeInTheDocument(); // Settings
      expect(screen.getByText('/')).toBeInTheDocument(); // Search
    });

    it('should render help text in footer', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('to navigate')).toBeInTheDocument();
      expect(screen.getByText('to select')).toBeInTheDocument();
      expect(screen.getByText('to close')).toBeInTheDocument();
    });
  });

  describe('Search Filtering', () => {
    it('should filter commands based on search query', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('Type a command or search...');
      await user.type(searchInput, 'upload');

      expect(screen.getByText('Upload Images')).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('Go to Home')).not.toBeInTheDocument();
    });

    it('should show "No commands found" when search has no matches', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('Type a command or search...');
      await user.type(searchInput, 'nonexistent');

      expect(screen.getByText('No commands found')).toBeInTheDocument();
    });

    it('should be case-insensitive when filtering', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('Type a command or search...');
      await user.type(searchInput, 'SETTINGS');

      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should clear search query when palette reopens', async () => {
      const { rerender } = render(
        <CommandPalette isOpen={true} onClose={mockOnClose} />
      );

      const searchInput = screen.getByPlaceholderText('Type a command or search...') as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput.value).toBe('test');

      // Close and reopen
      rerender(<CommandPalette isOpen={false} onClose={mockOnClose} />);
      rerender(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      // Wait for the useEffect to clear the search query
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type a command or search...') as HTMLInputElement).toHaveValue('');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close when Escape is pressed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should navigate down with ArrowDown key', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const commands = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Upload') || btn.textContent?.includes('Settings')
      );

      // First command should be selected initially
      expect(commands[0]).toHaveClass('bg-[#7C5CFF]/10');

      // Press ArrowDown
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Second command should now be selected
      expect(commands[1]).toHaveClass('bg-[#7C5CFF]/10');
    });

    it('should navigate up with ArrowUp key', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      // Press ArrowUp from first item - should wrap to last
      fireEvent.keyDown(document, { key: 'ArrowUp' });

      const commands = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Sign Out')
      );
      expect(commands[0]).toHaveClass('bg-[#7C5CFF]/10');
    });

    it('should wrap to first when navigating down from last item', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const commands = screen.getAllByRole('button').filter(btn =>
        btn.textContent?.includes('Upload')
      );

      // Navigate to last item then one more down
      for (let i = 0; i < 5; i++) {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      }

      // Should wrap back to first
      expect(commands[0]).toHaveClass('bg-[#7C5CFF]/10');
    });

    it('should execute selected command when Enter is pressed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      // Navigate to second command (Settings)
      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Press Enter
      fireEvent.keyDown(document, { key: 'Enter' });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/app/settings');
    });

    it('should execute command via shortcut key', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onUpload={mockOnUpload} />);

      // Press 'u' for Upload
      fireEvent.keyDown(document, { key: 'u' });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnUpload).toHaveBeenCalled();
    });

    it('should update selected index on mouse hover', async () => {
      const user = userEvent.setup();
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const settingsButton = screen.getByText('Settings').closest('button')!;

      await user.hover(settingsButton);

      expect(settingsButton).toHaveClass('bg-[#7C5CFF]/10');
    });
  });

  describe('Command Actions', () => {
    it('should call onUpload when Upload command is executed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onUpload={mockOnUpload} />);

      const uploadButton = screen.getByText('Upload Images').closest('button')!;
      fireEvent.click(uploadButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnUpload).toHaveBeenCalled();
    });

    it('should navigate to /app/upload when Upload executed without onUpload callback', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const uploadButton = screen.getByText('Upload Images').closest('button')!;
      fireEvent.click(uploadButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/app/upload');
    });

    it('should navigate to /app/settings when Settings command is executed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const settingsButton = screen.getByText('Settings').closest('button')!;
      fireEvent.click(settingsButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/app/settings');
    });

    it('should navigate to /app when Home command is executed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const homeButton = screen.getByText('Go to Home').closest('button')!;
      fireEvent.click(homeButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/app');
    });

    it('should call onSignOut when Sign Out command is executed', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} onSignOut={mockOnSignOut} />);

      const signOutButton = screen.getByText('Sign Out').closest('button')!;
      fireEvent.click(signOutButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSignOut).toHaveBeenCalled();
    });

    it('should focus search input when Search command is executed', async () => {
      // Mock querySelector and focus
      const mockSearchInput = document.createElement('input');
      mockSearchInput.type = 'search';
      const focusSpy = vi.spyOn(mockSearchInput, 'focus');
      vi.spyOn(document, 'querySelector').mockReturnValue(mockSearchInput);

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchButton = screen.getByText('Search').closest('button')!;
      fireEvent.click(searchButton);

      expect(mockOnClose).toHaveBeenCalled();

      // Wait for setTimeout to complete
      await waitFor(() => {
        expect(focusSpy).toHaveBeenCalled();
      }, { timeout: 200 });
    });
  });

  describe('Backdrop Interaction', () => {
    it('should close when backdrop is clicked', () => {
      const { container } = render(
        <CommandPalette isOpen={true} onClose={mockOnClose} />
      );

      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/60');
      fireEvent.click(backdrop!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking inside the palette', () => {
      render(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('Type a command or search...');
      fireEvent.click(searchInput);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should focus search input when palette opens', () => {
      const { rerender } = render(
        <CommandPalette isOpen={false} onClose={mockOnClose} />
      );

      rerender(<CommandPalette isOpen={true} onClose={mockOnClose} />);

      const searchInput = screen.getByPlaceholderText('Type a command or search...');
      expect(document.activeElement).toBe(searchInput);
    });
  });
});

describe('useCommandPalette Hook', () => {
  it('should initialize with isOpen false', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);
  });

  it('should open palette when openPalette is called', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.openPalette();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('should close palette when closePalette is called', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.openPalette();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closePalette();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('should toggle palette when togglePalette is called', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.togglePalette();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.togglePalette();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChips, FilterChip } from '@/components/chrome/filter-chips';
import React from 'react';

describe('FilterChips', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all filter buttons', () => {
      render(<FilterChips />);

      expect(screen.getByLabelText('All')).toBeInTheDocument();
      expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
      expect(screen.getByLabelText('Recent')).toBeInTheDocument();
    });

    it('should render with labels by default', () => {
      render(<FilterChips />);

      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(screen.getByText('Recent')).toBeInTheDocument();
    });

    it('should render without labels when showLabels is false', () => {
      render(<FilterChips showLabels={false} />);

      expect(screen.queryByText('All')).not.toBeInTheDocument();
      expect(screen.queryByText('Favorites')).not.toBeInTheDocument();
      expect(screen.queryByText('Recent')).not.toBeInTheDocument();

      // Labels should still exist in aria-label
      expect(screen.getByLabelText('All')).toBeInTheDocument();
      expect(screen.getByLabelText('Favorites')).toBeInTheDocument();
      expect(screen.getByLabelText('Recent')).toBeInTheDocument();
    });

    it('should render filter group with correct role', () => {
      render(<FilterChips />);

      const group = screen.getByRole('group', { name: 'Filter options' });
      expect(group).toBeInTheDocument();
    });

    it('should render icons for Favorites and Recent filters', () => {
      const { container } = render(<FilterChips />);

      // Should have 2 SVG icons (Favorites and Recent, but not All)
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBe(2);
    });

    it('should apply custom className', () => {
      render(<FilterChips className="custom-class" />);

      const group = screen.getByRole('group');
      expect(group).toHaveClass('custom-class');
    });
  });

  describe('Active State', () => {
    it('should mark "all" as active by default', () => {
      render(<FilterChips />);

      const allButton = screen.getByLabelText('All');
      expect(allButton).toHaveAttribute('aria-pressed', 'true');
      expect(allButton).toHaveClass('bg-primary', 'text-white');
    });

    it('should mark Favorites as active when activeFilter is "favorites"', () => {
      render(<FilterChips activeFilter="favorites" />);

      const favoritesButton = screen.getByLabelText('Favorites');
      expect(favoritesButton).toHaveAttribute('aria-pressed', 'true');
      expect(favoritesButton).toHaveClass('bg-primary', 'text-white');

      const allButton = screen.getByLabelText('All');
      expect(allButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should mark Recent as active when activeFilter is "recent"', () => {
      render(<FilterChips activeFilter="recent" />);

      const recentButton = screen.getByLabelText('Recent');
      expect(recentButton).toHaveAttribute('aria-pressed', 'true');
      expect(recentButton).toHaveClass('bg-primary', 'text-white');
    });

    it('should fill favorites icon when active', () => {
      const { container } = render(<FilterChips activeFilter="favorites" />);

      const favoritesButton = screen.getByLabelText('Favorites');
      const icon = favoritesButton.querySelector('svg');

      expect(icon).toHaveAttribute('fill', 'currentColor');
    });

    it('should not fill favorites icon when inactive', () => {
      const { container } = render(<FilterChips activeFilter="all" />);

      const favoritesButton = screen.getByLabelText('Favorites');
      const icon = favoritesButton.querySelector('svg');

      expect(icon).toHaveAttribute('fill', 'none');
    });
  });

  describe('Click Behavior', () => {
    it('should call onFilterChange with "all" when All is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterChips onFilterChange={mockOnFilterChange} />);

      const allButton = screen.getByLabelText('All');
      await user.click(allButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith('all');
    });

    it('should call onFilterChange with "favorites" when Favorites is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterChips onFilterChange={mockOnFilterChange} />);

      const favoritesButton = screen.getByLabelText('Favorites');
      await user.click(favoritesButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith('favorites');
    });

    it('should call onFilterChange with "recent" when Recent is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterChips onFilterChange={mockOnFilterChange} />);

      const recentButton = screen.getByLabelText('Recent');
      await user.click(recentButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith('recent');
    });

    it('should not error when onFilterChange is not provided', async () => {
      const user = userEvent.setup();
      render(<FilterChips />);

      const allButton = screen.getByLabelText('All');

      // Should not throw
      await expect(user.click(allButton)).resolves.not.toThrow();
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes when size is "sm"', () => {
      render(<FilterChips size="sm" />);

      const allButton = screen.getByLabelText('All');
      expect(allButton).toHaveClass('h-7', 'text-xs');
    });

    it('should apply medium size classes by default', () => {
      render(<FilterChips />);

      const allButton = screen.getByLabelText('All');
      expect(allButton).toHaveClass('h-8', 'text-sm');
    });

    it('should apply large size classes when size is "lg"', () => {
      render(<FilterChips size="lg" />);

      const allButton = screen.getByLabelText('All');
      expect(allButton).toHaveClass('h-9', 'text-base');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for all filters', () => {
      render(<FilterChips />);

      expect(screen.getByLabelText('All')).toHaveAccessibleName('All');
      expect(screen.getByLabelText('Favorites')).toHaveAccessibleName('Favorites');
      expect(screen.getByLabelText('Recent')).toHaveAccessibleName('Recent');
    });

    it('should have correct aria-pressed states', () => {
      render(<FilterChips activeFilter="favorites" />);

      expect(screen.getByLabelText('All')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByLabelText('Favorites')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByLabelText('Recent')).toHaveAttribute('aria-pressed', 'false');
    });

    it('should have title attributes for tooltips', () => {
      render(<FilterChips />);

      expect(screen.getByLabelText('All')).toHaveAttribute('title', 'All');
      expect(screen.getByLabelText('Favorites')).toHaveAttribute('title', 'Favorites');
      expect(screen.getByLabelText('Recent')).toHaveAttribute('title', 'Recent');
    });
  });
});

describe('FilterChip', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render chip with label', () => {
      render(<FilterChip label="Test Filter" />);

      expect(screen.getByText('Test Filter')).toBeInTheDocument();
    });

    it('should render with icon when provided', () => {
      const icon = <svg data-testid="test-icon" />;
      render(<FilterChip label="Test" icon={icon} />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should render without icon when not provided', () => {
      const { container } = render(<FilterChip label="Test" />);

      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<FilterChip label="Test" className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Active State', () => {
    it('should not be active by default', () => {
      render(<FilterChip label="Test" />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      expect(button).toHaveClass('bg-muted', 'text-muted-foreground');
    });

    it('should show active state when isActive is true', () => {
      render(<FilterChip label="Test" isActive={true} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(button).toHaveClass('bg-primary', 'text-white');
    });
  });

  describe('Click Behavior', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      render(<FilterChip label="Test" onClick={mockOnClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not error when onClick is not provided', async () => {
      const user = userEvent.setup();
      render(<FilterChip label="Test" />);

      const button = screen.getByRole('button');

      // Should not throw
      await expect(user.click(button)).resolves.not.toThrow();
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes when size is "sm"', () => {
      render(<FilterChip label="Test" size="sm" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-7', 'text-xs');
    });

    it('should apply medium size classes by default', () => {
      render(<FilterChip label="Test" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8', 'text-sm');
    });

    it('should apply large size classes when size is "lg"', () => {
      render(<FilterChip label="Test" size="lg" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9', 'text-base');
    });
  });
});

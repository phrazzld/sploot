import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewModeToggle, ViewModeCycle } from '@/components/chrome/view-mode-toggle';
import React from 'react';

describe('ViewModeToggle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render both grid and list mode buttons', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('Grid')).toBeInTheDocument();
      expect(screen.getByLabelText('List')).toBeInTheDocument();
    });

    it('should render as a radiogroup', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const radiogroup = screen.getByRole('radiogroup', { name: 'View mode' });
      expect(radiogroup).toBeInTheDocument();
    });

    it('should render buttons with radio role', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
    });

    it('should render grid and list icons', () => {
      const { container } = render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBe(2);
    });

    it('should not show labels by default', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      expect(screen.queryByText('Grid')).not.toBeInTheDocument();
      expect(screen.queryByText('List')).not.toBeInTheDocument();
    });

    it('should show labels when showLabels is true', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} showLabels={true} />);

      expect(screen.getByText('Grid')).toBeInTheDocument();
      expect(screen.getByText('List')).toBeInTheDocument();
    });

    it('should apply custom className to container', () => {
      const { container } = render(
        <ViewModeToggle value="grid" onChange={mockOnChange} className="custom-class" />
      );

      const radiogroup = container.querySelector('[role="radiogroup"]');
      expect(radiogroup).toHaveClass('custom-class');
    });

    it('should apply custom buttonClassName to buttons', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} buttonClassName="button-class" />);

      const gridButton = screen.getByLabelText('Grid');
      const listButton = screen.getByLabelText('List');

      expect(gridButton).toHaveClass('button-class');
      expect(listButton).toHaveClass('button-class');
    });
  });

  describe('Active State', () => {
    it('should mark grid button as checked when value is "grid"', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should mark list button as checked when value is "list"', () => {
      render(<ViewModeToggle value="list" onChange={mockOnChange} />);

      const listButton = screen.getByLabelText('List');
      expect(listButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should apply active styling to grid button when selected', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton).toHaveClass('bg-[#7C5CFF]', 'text-white');
    });

    it('should apply active styling to list button when selected', () => {
      render(<ViewModeToggle value="list" onChange={mockOnChange} />);

      const listButton = screen.getByLabelText('List');
      expect(listButton).toHaveClass('bg-[#7C5CFF]', 'text-white');
    });

    it('should show active indicator dot when button is active', () => {
      const { container } = render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      // Active button should have an indicator dot
      const indicators = container.querySelectorAll('.w-1.h-1.bg-\\[\\#B6FF6E\\]');
      expect(indicators.length).toBe(1);
    });

    it('should scale icon when button is active', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      const iconWrapper = gridButton.querySelector('span');

      expect(iconWrapper).toHaveClass('scale-110');
    });
  });

  describe('Click Behavior', () => {
    it('should call onChange with "grid" when grid button is clicked', async () => {
      const user = userEvent.setup();
      render(<ViewModeToggle value="list" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      await user.click(gridButton);

      expect(mockOnChange).toHaveBeenCalledWith('grid');
    });

    it('should call onChange with "list" when list button is clicked', async () => {
      const user = userEvent.setup();
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const listButton = screen.getByLabelText('List');
      await user.click(listButton);

      expect(mockOnChange).toHaveBeenCalledWith('list');
    });

    it('should allow clicking the currently active button', async () => {
      const user = userEvent.setup();
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      await user.click(gridButton);

      expect(mockOnChange).toHaveBeenCalledWith('grid');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes when size is "sm"', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} size="sm" />);

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton).toHaveClass('w-8', 'h-8');
    });

    it('should apply medium size classes by default', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton).toHaveClass('w-10', 'h-10');
    });

    it('should apply large size classes when size is "lg"', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} size="lg" />);

      const gridButton = screen.getByLabelText('Grid');
      expect(gridButton).toHaveClass('w-12', 'h-12');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for both buttons', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('Grid')).toHaveAccessibleName('Grid');
      expect(screen.getByLabelText('List')).toHaveAccessibleName('List');
    });

    it('should have correct aria-checked states', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('Grid')).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByLabelText('List')).toHaveAttribute('aria-checked', 'false');
    });

    it('should have title attributes for tooltips', () => {
      render(<ViewModeToggle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('Grid')).toHaveAttribute('title', 'Grid');
      expect(screen.getByLabelText('List')).toHaveAttribute('title', 'List');
    });
  });
});

describe('ViewModeCycle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render a single button', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should show grid icon when value is "grid"', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const button = screen.getByLabelText('View mode: grid');
      expect(button).toBeInTheDocument();
    });

    it('should show list icon when value is "list"', () => {
      render(<ViewModeCycle value="list" onChange={mockOnChange} />);

      const button = screen.getByLabelText('View mode: list');
      expect(button).toBeInTheDocument();
    });

    it('should render an SVG icon', () => {
      const { container } = render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} className="custom-class" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Cycle Behavior', () => {
    it('should cycle from grid to list when clicked', async () => {
      const user = userEvent.setup();
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnChange).toHaveBeenCalledWith('list');
    });

    it('should cycle from list to grid when clicked', async () => {
      const user = userEvent.setup();
      render(<ViewModeCycle value="list" onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(mockOnChange).toHaveBeenCalledWith('grid');
    });
  });

  describe('Size Variants', () => {
    it('should apply small size classes when size is "sm"', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} size="sm" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-8', 'h-8', 'text-xs');
    });

    it('should apply medium size classes by default', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-10', 'h-10', 'text-sm');
    });

    it('should apply large size classes when size is "lg"', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} size="lg" />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-12', 'h-12', 'text-base');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label showing current mode', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('View mode: grid')).toBeInTheDocument();
    });

    it('should have title attribute with cycle hint', () => {
      render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'View mode: grid (click to cycle)');
    });

    it('should update label when mode changes', () => {
      const { rerender } = render(<ViewModeCycle value="grid" onChange={mockOnChange} />);

      expect(screen.getByLabelText('View mode: grid')).toBeInTheDocument();

      rerender(<ViewModeCycle value="list" onChange={mockOnChange} />);

      expect(screen.getByLabelText('View mode: list')).toBeInTheDocument();
    });
  });
});

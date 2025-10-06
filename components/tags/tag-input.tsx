'use client';

import { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  className?: string;
  disabled?: boolean;
}

export function TagInput({
  tags,
  onTagsChange,
  placeholder = 'Add tags...',
  maxTags = 10,
  className,
  disabled = false
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = () => {
    const trimmedValue = inputValue.trim().toLowerCase();

    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < maxTags) {
      onTagsChange([...tags, trimmedValue]);
      setInputValue('');
    }
  };

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onTagsChange(newTags);
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    // TODO: Fetch tag suggestions from API based on input
  };

  return (
    <div className={cn(
      'w-full',
      className
    )}>
      <div className={cn(
        'flex flex-wrap items-center gap-2 p-3  border transition-colors',
        'bg-[#1B1F24] border-[#2A2F37]',
        'focus-within:border-[#7C5CFF] focus-within:bg-[#1B1F24]/80',
        disabled && 'opacity-50 pointer-events-none'
      )}>
        {/* Tag pills */}
        {tags.map((tag, index) => (
          <div
            key={`${tag}-${index}`}
            className="flex items-center gap-1 px-3 py-1 bg-[#7C5CFF]/10 text-[#7C5CFF] text-sm"
          >
            <span>{tag}</span>
            {!disabled && (
              <button
                onClick={() => removeTag(index)}
                className="ml-1 hover:text-[#9B7FFF] transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Input field */}
        {tags.length < maxTags && !disabled && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={tags.length === 0 ? placeholder : ''}
            className="flex-1 min-w-[120px] bg-transparent text-[#E6E8EB] placeholder-[#B3B7BE]/50 outline-none text-sm"
          />
        )}
      </div>

      {/* Helper text */}
      <p className="mt-2 text-xs text-[#B3B7BE]/60">
        Press Enter or comma to add a tag • {tags.length}/{maxTags} tags
      </p>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/chrome/navbar';
import { cn } from '@/lib/utils';

export default function TestTabOrderPage() {
  const [focusedElement, setFocusedElement] = useState<string>('');
  const [tabHistory, setTabHistory] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry' | 'list'>('grid');

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const description = getElementDescription(target);
      setFocusedElement(description);
      setTabHistory(prev => [...prev.slice(-9), description]);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' && e.metaKey) {
        // Cmd+C to clear history
        setTabHistory([]);
      }
    };

    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('focusin', handleFocus, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getElementDescription = (element: HTMLElement): string => {
    const tag = element.tagName.toLowerCase();
    const text = element.textContent?.slice(0, 30) || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const className = element.className.slice(0, 50);

    if (ariaLabel) return `${tag}[${ariaLabel}]`;
    if (placeholder) return `${tag}[${placeholder}]`;
    if (text) return `${tag}[${text.trim()}]`;
    return `${tag}.${className}`;
  };

  const mockGridItems = Array.from({ length: 6 }, (_, i) => ({
    id: `item-${i}`,
    title: `Image ${i + 1}`,
  }));

  return (
    <>
      {/* Navbar with all interactive elements */}
      <Navbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={true}
        showUploadButton={true}
        showUserAvatar={true}
        onUploadClick={() => console.log('Upload clicked')}
        onSignOut={() => console.log('Sign out clicked')}
      />

      {/* Main content area */}
      <main className="min-h-screen bg-[#0A0B0D] pt-14 pb-11">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-[#E6E8EB] mb-6">Tab Order Test Page</h1>

          {/* Focus indicator */}
          <div className="mb-8 p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-lg font-semibold text-[#E6E8EB] mb-2">Currently Focused:</h2>
            <p className={cn(
              'text-[#B6FF6E] font-mono text-sm',
              focusedElement ? 'text-[#B6FF6E]' : 'text-[#B3B7BE]'
            )}>
              {focusedElement || 'No element focused'}
            </p>
          </div>

          {/* Tab history */}
          <div className="mb-8 p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-lg font-semibold text-[#E6E8EB] mb-2">
              Tab History (last 10):
              <span className="text-xs text-[#B3B7BE] ml-2">(Cmd+C to clear)</span>
            </h2>
            <div className="space-y-1">
              {tabHistory.length === 0 ? (
                <p className="text-[#B3B7BE] text-sm">No tab history yet. Press Tab to navigate.</p>
              ) : (
                tabHistory.map((item, index) => (
                  <div key={index} className="text-[#B3B7BE] font-mono text-xs">
                    {index + 1}. {item}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expected tab order */}
          <div className="mb-8 p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-lg font-semibold text-[#E6E8EB] mb-2">Expected Tab Order:</h2>
            <ol className="list-decimal list-inside space-y-1 text-[#B3B7BE] text-sm">
              <li>Logo (link to /app)</li>
              <li>Search bar</li>
              <li>View mode toggles (Grid/Masonry/List)</li>
              <li>Upload button</li>
              <li>User avatar dropdown</li>
              <li>Main content grid items</li>
              <li>Footer filter chips (All/Favorites/Recent)</li>
              <li>Footer sort dropdown</li>
              <li>Footer settings gear</li>
            </ol>
          </div>

          {/* Mock grid content */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {mockGridItems.map((item) => (
              <button
                key={item.id}
                className="p-4 bg-[#1B1F24] border border-[#2A2F37] rounded-lg hover:border-[#7C5CFF]/50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C5CFF] focus:ring-offset-2 focus:ring-offset-[#0A0B0D]"
                onClick={() => console.log(`Clicked ${item.title}`)}
              >
                <div className="h-32 bg-[#2A2F37] rounded mb-2"></div>
                <p className="text-[#E6E8EB] text-sm">{item.title}</p>
              </button>
            ))}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
            <h2 className="text-lg font-semibold text-[#7C5CFF] mb-2">Instructions:</h2>
            <ul className="space-y-1 text-[#B3B7BE] text-sm">
              <li>• Press <kbd className="px-1 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Tab</kbd> to navigate forward</li>
              <li>• Press <kbd className="px-1 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Shift+Tab</kbd> to navigate backward</li>
              <li>• The focused element and tab history will update automatically</li>
              <li>• Verify that the tab order matches the expected sequence</li>
              <li>• Press <kbd className="px-1 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Cmd+C</kbd> to clear the tab history</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer removed - no longer part of the app chrome */}
    </>
  );
}
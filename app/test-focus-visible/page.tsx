'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function TestFocusVisiblePage() {
  const [lastInteraction, setLastInteraction] = useState<'mouse' | 'keyboard' | null>(null);
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Focus-Visible Ring Test</h1>
          <p className="text-[#B3B7BE]">
            Focus rings appear only when using keyboard navigation (Tab key), not when clicking with mouse.
          </p>
        </div>

        {/* Interaction indicator */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Last Interaction Type:</h2>
          <p className={cn(
            'text-lg font-mono',
            lastInteraction === 'keyboard' ? 'text-[#B6FF6E]' :
            lastInteraction === 'mouse' ? 'text-[#7C5CFF]' :
            'text-[#B3B7BE]'
          )}>
            {lastInteraction ? lastInteraction.toUpperCase() : 'None yet'}
          </p>
          <p className="text-sm text-[#B3B7BE] mt-2">
            Click count: {clickCount}
          </p>
        </div>

        {/* Test elements grid */}
        <div className="grid gap-6">
          {/* Buttons section */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#E6E8EB]">Buttons</h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="px-4 py-2 bg-[#7C5CFF] hover:bg-[#6B4FE6] text-white rounded-lg transition-colors"
              >
                Primary Button
              </button>

              <button
                onClick={() => {
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="px-4 py-2 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#E6E8EB] border border-[#2A2F37] rounded-lg transition-colors"
              >
                Secondary Button
              </button>

              <button
                onClick={() => {
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="px-4 py-2 bg-[#B6FF6E] hover:bg-[#A5F05D] text-black rounded-full transition-colors"
              >
                Rounded Button
              </button>

              <button
                onClick={() => {
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="p-2 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#E6E8EB] rounded-lg transition-colors"
                aria-label="Icon button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </section>

          {/* Links section */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#E6E8EB]">Links</h2>
            <div className="flex flex-wrap gap-4">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="text-[#7C5CFF] hover:text-[#6B4FE6] underline"
              >
                Text Link
              </a>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={() => setLastInteraction('keyboard')}
                className="px-4 py-2 bg-[#1B1F24] hover:bg-[#2A2F37] text-[#E6E8EB] rounded-lg inline-block transition-colors"
              >
                Button-style Link
              </a>
            </div>
          </section>

          {/* Form elements section */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#E6E8EB]">Form Elements</h2>
            <div className="space-y-4 max-w-md">
              <input
                type="text"
                placeholder="Text input"
                onFocus={() => setLastInteraction('keyboard')}
                onClick={() => setLastInteraction('mouse')}
                className="w-full px-3 py-2 bg-[#1B1F24] border border-[#2A2F37] text-[#E6E8EB] rounded-lg placeholder:text-[#B3B7BE]/60"
              />

              <textarea
                placeholder="Textarea"
                onFocus={() => setLastInteraction('keyboard')}
                onClick={() => setLastInteraction('mouse')}
                className="w-full px-3 py-2 bg-[#1B1F24] border border-[#2A2F37] text-[#E6E8EB] rounded-lg placeholder:text-[#B3B7BE]/60 resize-none h-20"
              />

              <select
                onFocus={() => setLastInteraction('keyboard')}
                onClick={() => setLastInteraction('mouse')}
                className="w-full px-3 py-2 bg-[#1B1F24] border border-[#2A2F37] text-[#E6E8EB] rounded-lg"
              >
                <option>Option 1</option>
                <option>Option 2</option>
                <option>Option 3</option>
              </select>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  onFocus={() => setLastInteraction('keyboard')}
                  onClick={() => setLastInteraction('mouse')}
                  className="w-4 h-4 bg-[#1B1F24] border border-[#2A2F37] rounded"
                />
                <span className="text-[#E6E8EB]">Checkbox</span>
              </label>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="radio-test"
                    onFocus={() => setLastInteraction('keyboard')}
                    onClick={() => setLastInteraction('mouse')}
                    className="w-4 h-4 bg-[#1B1F24] border border-[#2A2F37]"
                  />
                  <span className="text-[#E6E8EB]">Radio 1</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="radio-test"
                    onFocus={() => setLastInteraction('keyboard')}
                    onClick={() => setLastInteraction('mouse')}
                    className="w-4 h-4 bg-[#1B1F24] border border-[#2A2F37]"
                  />
                  <span className="text-[#E6E8EB]">Radio 2</span>
                </label>
              </div>
            </div>
          </section>

          {/* Custom elements section */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-[#E6E8EB]">Custom Interactive Elements</h2>
            <div className="flex flex-wrap gap-4">
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setClickCount(c => c + 1);
                  setLastInteraction('mouse');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setClickCount(c => c + 1);
                  }
                  setLastInteraction('keyboard');
                }}
                className="px-4 py-2 bg-[#2A2F37] hover:bg-[#3A3F47] text-[#E6E8EB] rounded-lg cursor-pointer transition-colors"
              >
                Custom Button (div with role)
              </div>

              <details className="bg-[#1B1F24] rounded-lg overflow-hidden">
                <summary
                  className="px-4 py-2 cursor-pointer hover:bg-[#2A2F37] transition-colors"
                  onClick={() => setLastInteraction('mouse')}
                  onKeyDown={() => setLastInteraction('keyboard')}
                >
                  Expandable Details
                </summary>
                <div className="px-4 py-2 border-t border-[#2A2F37]">
                  <p className="text-[#B3B7BE]">Hidden content here</p>
                </div>
              </details>
            </div>
          </section>

          {/* Instructions */}
          <section className="mt-12 p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
            <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">How to Test</h2>
            <ol className="space-y-2 text-[#B3B7BE]">
              <li>1. Click any element with your mouse - <strong>no focus ring should appear</strong></li>
              <li>2. Press <kbd className="px-2 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Tab</kbd> to navigate - <strong>purple focus rings should appear</strong></li>
              <li>3. The focus ring should have:
                <ul className="ml-6 mt-1 space-y-1 text-sm">
                  <li>• 2px solid purple border (#7C5CFF)</li>
                  <li>• 2px offset from the element</li>
                  <li>• Respect border radius of elements</li>
                </ul>
              </li>
              <li>4. Form inputs have no offset to prevent layout shift</li>
              <li>5. Focus rings work with all interactive elements</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
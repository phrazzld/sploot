'use client';

import { CommandPalette, useCommandPalette } from '@/components/chrome/command-palette';
import { useSearchShortcut } from '@/hooks/use-keyboard-shortcut';

export default function TestCommandPalettePage() {
  const { isOpen, openPalette, closePalette } = useCommandPalette();

  // Register ⌘K / Ctrl+K shortcut
  useSearchShortcut(openPalette);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Command Palette Test</h1>

        <div className="space-y-6">
          <div className="bg-[#14171A] border border-[#2A2F37] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Keyboard Shortcut</h2>
            <p className="text-[#B3B7BE] mb-4">
              Press <kbd className="px-2 py-1 bg-[#1B1F24] border border-[#2A2F37] rounded">⌘K</kbd> (Mac) or <kbd className="px-2 py-1 bg-[#1B1F24] border border-[#2A2F37] rounded">Ctrl+K</kbd> (Windows/Linux) to open the command palette.
            </p>
            <button
              onClick={openPalette}
              className="px-4 py-2 bg-[#7C5CFF] hover:bg-[#6B4FE6] text-white rounded-lg transition-colors"
            >
              Open Command Palette Manually
            </button>
          </div>

          <div className="bg-[#14171A] border border-[#2A2F37] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Available Commands</h2>
            <ul className="space-y-2 text-[#B3B7BE]">
              <li>• <strong>Upload Images</strong> (Shortcut: U) - Navigate to upload page</li>
              <li>• <strong>Settings</strong> (Shortcut: S) - Open settings page</li>
              <li>• <strong>Search</strong> (Shortcut: /) - Focus search bar</li>
              <li>• <strong>Go to Home</strong> - Return to main app page</li>
              <li>• <strong>Sign Out</strong> - Log out of the application</li>
            </ul>
          </div>

          <div className="bg-[#14171A] border border-[#2A2F37] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Navigation</h2>
            <ul className="space-y-2 text-[#B3B7BE]">
              <li>• Use <kbd className="px-1.5 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">↑</kbd> <kbd className="px-1.5 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">↓</kbd> arrow keys to navigate</li>
              <li>• Press <kbd className="px-1.5 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Enter</kbd> to select a command</li>
              <li>• Press <kbd className="px-1.5 py-0.5 bg-[#1B1F24] border border-[#2A2F37] rounded text-xs">Esc</kbd> to close</li>
              <li>• Type to search/filter commands</li>
              <li>• Use single letter shortcuts (U, S, /) for quick access</li>
            </ul>
          </div>

          <div className="bg-[#14171A] border border-[#2A2F37] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Status</h2>
            <p className="text-[#B3B7BE]">
              Command palette is currently: <span className={isOpen ? 'text-green-400' : 'text-red-400'}>{isOpen ? 'Open' : 'Closed'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Command Palette Component */}
      <CommandPalette
        isOpen={isOpen}
        onClose={closePalette}
        onUpload={() => console.log('Upload action')}
        onSignOut={() => console.log('Sign out action')}
      />
    </div>
  );
}
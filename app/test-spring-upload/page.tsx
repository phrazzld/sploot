'use client';

import { useState } from 'react';
import { UploadButton, UploadButtonFloating } from '@/components/chrome/upload-button';
import { cn } from '@/lib/utils';

export default function TestSpringUploadPage() {
  const [clickCount, setClickCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [springConfig, setSpringConfig] = useState({
    stiffness: 400,
    damping: 25,
    mass: 1,
  });

  const handleUploadClick = () => {
    setClickCount(prev => prev + 1);
    setIsActive(true);
    setTimeout(() => setIsActive(false), 1000);
  };

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E6E8EB] p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4">Upload Button Spring Physics Test</h1>
          <p className="text-[#B3B7BE]">
            Testing spring physics animation with 1.05 scale on hover, 0.95 scale on click
          </p>
        </div>

        {/* Stats Display */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Interaction Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[#B3B7BE]">Click Count</p>
              <p className="text-2xl font-mono text-[#7C5CFF]">{clickCount}</p>
            </div>
            <div>
              <p className="text-sm text-[#B3B7BE]">Active State</p>
              <p className="text-2xl font-mono text-[#B6FF6E]">{isActive ? 'Active' : 'Idle'}</p>
            </div>
            <div>
              <p className="text-sm text-[#B3B7BE]">Animation Type</p>
              <p className="text-2xl font-mono text-[#BAFF39]">Spring</p>
            </div>
          </div>
        </div>

        {/* Spring Configuration */}
        <div className="p-4 bg-[#14171A] border border-[#2A2F37] rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Spring Configuration</h2>
          <p className="text-sm text-[#B3B7BE] mb-4">
            Adjust spring physics parameters to see different animation behaviors
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Stiffness: {springConfig.stiffness} (Higher = Snappier)
              </label>
              <input
                type="range"
                min="100"
                max="800"
                value={springConfig.stiffness}
                onChange={(e) => setSpringConfig(prev => ({ ...prev, stiffness: Number(e.target.value) }))}
                className="w-full accent-[#7C5CFF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Damping: {springConfig.damping} (Higher = Less Bouncy)
              </label>
              <input
                type="range"
                min="5"
                max="50"
                value={springConfig.damping}
                onChange={(e) => setSpringConfig(prev => ({ ...prev, damping: Number(e.target.value) }))}
                className="w-full accent-[#7C5CFF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Mass: {springConfig.mass.toFixed(1)} (Higher = Slower)
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={springConfig.mass}
                onChange={(e) => setSpringConfig(prev => ({ ...prev, mass: Number(e.target.value) }))}
                className="w-full accent-[#7C5CFF]"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setSpringConfig({ stiffness: 400, damping: 25, mass: 1 })}
              className="px-3 py-1.5 bg-[#1B1F24] hover:bg-[#2A2F37] text-sm rounded-lg transition-colors"
            >
              Default
            </button>
            <button
              onClick={() => setSpringConfig({ stiffness: 600, damping: 35, mass: 1.2 })}
              className="px-3 py-1.5 bg-[#1B1F24] hover:bg-[#2A2F37] text-sm rounded-lg transition-colors"
            >
              Snappy
            </button>
            <button
              onClick={() => setSpringConfig({ stiffness: 200, damping: 10, mass: 0.5 })}
              className="px-3 py-1.5 bg-[#1B1F24] hover:bg-[#2A2F37] text-sm rounded-lg transition-colors"
            >
              Bouncy
            </button>
            <button
              onClick={() => setSpringConfig({ stiffness: 300, damping: 30, mass: 2 })}
              className="px-3 py-1.5 bg-[#1B1F24] hover:bg-[#2A2F37] text-sm rounded-lg transition-colors"
            >
              Heavy
            </button>
          </div>
        </div>

        {/* Button Examples */}
        <div className="space-y-8">
          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Standard Upload Button</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">
              With label, fixed 100px width
            </p>
            <div className="flex justify-center gap-4">
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                size="sm"
              />
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                size="md"
              />
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                size="lg"
              />
            </div>
            <p className="text-xs text-[#B3B7BE] text-center mt-4">
              Sizes: Small, Medium, Large
            </p>
          </section>

          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Icon-Only Variants</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">
              Compact buttons without labels
            </p>
            <div className="flex justify-center gap-4">
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                showLabel={false}
                size="sm"
              />
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                showLabel={false}
                size="md"
              />
              <UploadButton
                onClick={handleUploadClick}
                isActive={isActive}
                showLabel={false}
                size="lg"
              />
            </div>
          </section>

          <section className="p-6 bg-[#14171A] border border-[#2A2F37] rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Floating Upload Button</h2>
            <p className="text-sm text-[#B3B7BE] mb-6">
              Round floating action button style
            </p>
            <div className="flex justify-center">
              <UploadButtonFloating onClick={handleUploadClick} />
            </div>
            <p className="text-xs text-[#B3B7BE] text-center mt-4">
              Uses slightly bouncier spring config for playful feel
            </p>
          </section>
        </div>

        {/* Technical Details */}
        <div className="p-6 bg-[#14171A] border border-[#7C5CFF]/30 rounded-lg">
          <h2 className="text-xl font-semibold text-[#7C5CFF] mb-4">Spring Physics Details</h2>
          <div className="space-y-3 text-[#B3B7BE]">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-[#E6E8EB]">Hover Scale:</p>
                <code className="text-[#B6FF6E]">1.05 (5% larger)</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Click Scale:</p>
                <code className="text-[#B6FF6E]">0.95 (5% smaller)</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Animation Method:</p>
                <code className="text-[#B6FF6E]">Spring Physics</code>
              </div>
              <div>
                <p className="font-semibold text-[#E6E8EB]">Frame Rate:</p>
                <code className="text-[#B6FF6E]">60 FPS</code>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">Spring Physics Formula:</p>
              <code className="block bg-[#0B0C0E] p-3 rounded text-xs text-[#B6FF6E]">
                F = -kx - cv<br/>
                acceleration = (springForce - dampingForce) / mass<br/>
                velocity += acceleration * deltaTime<br/>
                position += velocity * deltaTime
              </code>
            </div>

            <div className="mt-4 pt-4 border-t border-[#2A2F37]">
              <p className="text-sm mb-2">Features:</p>
              <ul className="ml-4 space-y-1 text-sm list-disc">
                <li>Natural physics-based motion</li>
                <li>Configurable stiffness, damping, and mass</li>
                <li>Smooth 60fps animation with requestAnimationFrame</li>
                <li>Automatic velocity and position calculations</li>
                <li>Touch-friendly with proper event handling</li>
                <li>No CSS transitions needed - pure JS physics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
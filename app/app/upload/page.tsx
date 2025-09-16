import { UploadZone } from '@/components/upload/upload-zone';

export default function UploadPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#E6E8EB]">Upload Memes</h1>
        <p className="text-[#B3B7BE] mt-2">
          Add images to your library with drag & drop, paste, or browse
        </p>
      </header>

      <main className="space-y-8">
        {/* Upload Zone */}
        <section>
          <UploadZone />
        </section>

        {/* Tips Section */}
        <section className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[#E6E8EB] mb-4">Pro Tips</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-[#7C5CFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[#7C5CFF]">📋</span>
              </div>
              <div>
                <h3 className="text-[#E6E8EB] text-sm font-medium mb-1">Paste from clipboard</h3>
                <p className="text-[#B3B7BE] text-xs">
                  Copy an image and paste it directly with Ctrl/Cmd+V
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 bg-[#B6FF6E]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[#B6FF6E]">🚀</span>
              </div>
              <div>
                <h3 className="text-[#E6E8EB] text-sm font-medium mb-1">Batch upload</h3>
                <p className="text-[#B3B7BE] text-xs">
                  Select or drop multiple files at once for faster uploads
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-10 h-10 bg-[#7C5CFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-[#7C5CFF]">🔍</span>
              </div>
              <div>
                <h3 className="text-[#E6E8EB] text-sm font-medium mb-1">Auto-embedding</h3>
                <p className="text-[#B3B7BE] text-xs">
                  Images are automatically indexed for semantic search
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Formats */}
        <section className="bg-[#14171A] border border-[#2A2F37] rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-[#E6E8EB] mb-4">Supported Formats</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1B1F24] rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🖼️</div>
              <p className="text-[#E6E8EB] text-sm font-medium">JPEG</p>
              <p className="text-[#B3B7BE] text-xs mt-1">.jpg, .jpeg</p>
            </div>

            <div className="bg-[#1B1F24] rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🎨</div>
              <p className="text-[#E6E8EB] text-sm font-medium">PNG</p>
              <p className="text-[#B3B7BE] text-xs mt-1">.png</p>
            </div>

            <div className="bg-[#1B1F24] rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🌐</div>
              <p className="text-[#E6E8EB] text-sm font-medium">WebP</p>
              <p className="text-[#B3B7BE] text-xs mt-1">.webp</p>
            </div>

            <div className="bg-[#1B1F24] rounded-xl p-4 text-center">
              <div className="text-2xl mb-2">🎬</div>
              <p className="text-[#E6E8EB] text-sm font-medium">GIF</p>
              <p className="text-[#B3B7BE] text-xs mt-1">.gif</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[#B3B7BE] text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Maximum file size: 10MB per image</span>
          </div>
        </section>
      </main>
    </div>
  );
}
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-lab-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Offline Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <svg
              className="w-24 h-24 text-lab-text-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <div className="absolute inset-0 animate-pulse">
              <svg
                className="w-24 h-24 text-lab-primary opacity-30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Offline Message */}
        <h1 className="text-3xl font-bold text-lab-text mb-4">
          You&apos;re Offline
        </h1>

        <p className="text-lab-text-secondary mb-8">
          It looks like you&apos;ve lost your internet connection. Don&apos;t worry, your work is saved locally.
        </p>

        {/* Features Available Offline */}
        <div className="bg-lab-surface border border-lab-border rounded-xl p-6 mb-8">
          <h2 className="text-sm font-semibold text-lab-text mb-4 uppercase tracking-wider">
            Available Offline
          </h2>
          <ul className="space-y-3 text-left">
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-lab-text">
                Browse previously cached images
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-lab-text">
                Queue uploads for when you&apos;re back online
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-lab-text">
                View your favorite images
              </span>
            </li>
          </ul>
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-center gap-2 text-sm text-lab-text-secondary">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>Waiting for connection...</span>
        </div>

        {/* Auto-refresh script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Check connection status every 3 seconds
              setInterval(() => {
                fetch('/api/health', { method: 'HEAD' })
                  .then(() => {
                    // Connection restored, reload the page
                    window.location.reload();
                  })
                  .catch(() => {
                    // Still offline
                  });
              }, 3000);
            `,
          }}
        />
      </div>
    </div>
  );
}
interface HeartIconProps {
  className?: string;
  filled?: boolean;
}

export function HeartIcon({ className = 'w-4 h-4', filled = false }: HeartIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {filled ? (
        <path
          d="M11.645 20.91l-.007-.005C6.522 16.764 3 13.786 3 9.75 3 7.079 5.086 5 7.75 5c1.623 0 3.127.81 4.02 2.09C12.663 5.81 14.167 5 15.79 5 18.454 5 20.54 7.079 20.54 9.75c0 4.037-3.522 7.015-8.638 11.154l-.456.359-.456-.353z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.676 0-3.193.845-4.062 2.222-.869-1.377-2.386-2.222-4.062-2.222C5.599 3.75 3.5 5.765 3.5 8.25c0 4.56 4.517 7.724 8.438 11.115.35.3.775.45 1.2.45.424 0 .848-.15 1.198-.45C16.483 15.974 21 12.81 21 8.25z"
          stroke="currentColor"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

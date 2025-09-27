/**
 * Temporary holding component for mobile header navigation
 * This extracts mobile header logic from the layout to prepare for navbar/footer migration
 */

import Link from 'next/link';
import { UserMenu } from './user-menu';

export function MobileHeader() {
  return (
    <header className="bg-[#14171A] border-b border-[#2A2F37] px-4 py-3 flex items-center justify-between">
      <Link href="/app" className="block">
        <h1 className="text-xl font-bold text-[#E6E8EB] tracking-wider lowercase">
          sploot
        </h1>
      </Link>
      <UserMenu variant="mobile" position="header" />
    </header>
  );
}
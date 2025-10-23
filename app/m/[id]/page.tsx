import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db';

interface PublicMemePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PublicMemePageProps): Promise<Metadata> {
  const { id } = await params;

  if (!prisma) {
    return { title: 'Meme not found' };
  }

  const asset = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, blobUrl: true, mime: true, width: true, height: true },
  });

  if (!asset) {
    return { title: 'Meme not found' };
  }

  return {
    title: 'Check out this meme',
    description: 'Shared via Sploot',
    openGraph: {
      title: 'Check out this meme',
      description: 'Shared via Sploot',
      images: [
        {
          url: asset.blobUrl,
          width: asset.width || 1200,
          height: asset.height || 630,
          alt: 'Meme',
        },
      ],
      siteName: 'Sploot',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Check out this meme',
      description: 'Shared via Sploot',
      images: [asset.blobUrl],
    },
  };
}

export default async function PublicMemePage({ params }: PublicMemePageProps) {
  const { id } = await params;

  if (!prisma) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <h1 className="text-white text-2xl mb-4">Meme not found</h1>
        <Link href="/" className="text-gray-500 hover:text-gray-400">
          Go to Sploot
        </Link>
      </div>
    );
  }

  const asset = await prisma.asset.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, blobUrl: true, mime: true, width: true, height: true },
  });

  if (!asset) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <h1 className="text-white text-2xl mb-4">Meme not found</h1>
        <Link href="/" className="text-gray-500 hover:text-gray-400">
          Go to Sploot
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <Image
        src={asset.blobUrl}
        alt="Shared meme"
        width={asset.width || 1200}
        height={asset.height || 630}
        className="max-w-full max-h-[90vh] object-contain"
        priority
      />
      <footer className="mt-8 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-400">
          Shared via Sploot
        </Link>
      </footer>
    </div>
  );
}

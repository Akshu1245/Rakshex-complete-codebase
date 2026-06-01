import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <h1 className="text-9xl font-bold text-blue-400 mb-4">404</h1>
        <h2 className="text-2xl font-bold text-white mb-2">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

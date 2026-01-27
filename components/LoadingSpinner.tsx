export default function LoadingSpinner({ size = 'md', text = 'Loading...' }: { size?: 'sm' | 'md' | 'lg'; text?: string }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`${sizeClasses[size]} relative`}>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      {text && <p className="mt-4 text-gray-600 font-medium">{text}</p>}
    </div>
  );
}

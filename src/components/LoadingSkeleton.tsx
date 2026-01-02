interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string;
  height?: string;
  lines?: number;
}

export default function LoadingSkeleton({ 
  className = "",
  variant = 'rectangular',
  width = 'w-full',
  height = 'h-4',
  lines = 1
}: LoadingSkeletonProps) {
  const baseClasses = "animate-pulse bg-muted rounded";
  
  const variantClasses = {
    text: `${height} ${width}`,
    circular: "rounded-full",
    rectangular: `${height} ${width}`,
    card: "h-32 w-full rounded-lg"
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${variantClasses.text} ${
              index === lines - 1 ? 'w-3/4' : ''
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
}

// Specific skeleton components for common use cases
export function MatchCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`pl-card animate-pulse ${className}`}>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <LoadingSkeleton variant="text" width="w-24" height="h-4" />
          <LoadingSkeleton variant="text" width="w-16" height="h-6" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <LoadingSkeleton variant="circular" width="w-10" height="h-10" />
            <LoadingSkeleton variant="text" width="w-20" height="h-4" />
          </div>
          <LoadingSkeleton variant="text" width="w-12" height="h-6" />
          <div className="flex items-center space-x-3 flex-1 justify-end">
            <LoadingSkeleton variant="text" width="w-20" height="h-4" />
            <LoadingSkeleton variant="circular" width="w-10" height="h-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeaderboardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`pl-card ${className}`}>
      <div className="p-6 space-y-4">
        <LoadingSkeleton variant="text" width="w-32" height="h-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <LoadingSkeleton variant="text" width="w-8" height="h-4" />
              <LoadingSkeleton variant="circular" width="w-8" height="h-8" />
              <LoadingSkeleton variant="text" width="w-24" height="h-4" />
              <div className="flex-1" />
              <LoadingSkeleton variant="text" width="w-16" height="h-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PredictionFormSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`pl-card ${className}`}>
      <div className="p-6 space-y-6">
        <div className="text-center space-y-2">
          <LoadingSkeleton variant="text" width="w-48" height="h-6" className="mx-auto" />
          <LoadingSkeleton variant="text" width="w-32" height="h-4" className="mx-auto" />
        </div>
        
        <div className="flex items-center justify-center space-x-8">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSkeleton variant="circular" width="w-12" height="h-12" />
            <LoadingSkeleton variant="text" width="w-20" height="h-3" />
            <LoadingSkeleton variant="rectangular" width="w-16" height="h-12" />
          </div>
          
          <LoadingSkeleton variant="text" width="w-4" height="h-8" />
          
          <div className="flex flex-col items-center space-y-3">
            <LoadingSkeleton variant="circular" width="w-12" height="h-12" />
            <LoadingSkeleton variant="text" width="w-20" height="h-3" />
            <LoadingSkeleton variant="rectangular" width="w-16" height="h-12" />
          </div>
        </div>
        
        <LoadingSkeleton variant="rectangular" width="w-full" height="h-12" />
      </div>
    </div>
  );
}
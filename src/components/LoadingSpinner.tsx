interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  message?: string;
}

export default function LoadingSpinner({ 
  size = "md", 
  message = "Loading..." 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] space-y-4">
      <div className="relative">
        <div
          className={`animate-spin rounded-full border-2 border-muted border-t-pl-primary ${sizeClasses[size]}`}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-pl-primary text-xs">⚽</span>
        </div>
      </div>
      {message && (
        <p className="text-muted-foreground text-sm font-medium text-center max-w-xs">
          {message}
        </p>
      )}
    </div>
  );
}
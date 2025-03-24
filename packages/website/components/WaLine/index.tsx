import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from 'react-error-boundary';

// Dynamically import the Waline component to avoid SSR issues
const WalineCore = dynamic(() => import('./core'), {
  ssr: false,
  loading: () => <div id="waline" className="mt-2" style={{ display: 'none' }}></div>,
});

// Error fallback component for the ErrorBoundary
const ErrorFallback = () => <div className="mt-2 py-4 text-gray-500 text-center">评论加载失败</div>;

export default function Waline(props: { enable: 'true' | 'false'; visible: boolean }) {
  // Add a key-based remounting strategy
  const [componentKey, setComponentKey] = useState(0);

  // Update key to force remount when visibility changes
  useEffect(() => {
    setComponentKey((prev) => prev + 1);
  }, [props.visible]);

  // If not enabled, don't render anything
  if (props.enable !== 'true') {
    return null;
  }

  // Always display debugging information in development
  if (process.env.NODE_ENV === 'development') {
    return (
      <div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <WalineCore key={componentKey} {...props} />
        </ErrorBoundary>
      </div>
    );
  }

  // In production, just render the Waline component with error boundary
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <WalineCore key={componentKey} {...props} />
    </ErrorBoundary>
  );
}

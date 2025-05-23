import 'client-only';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { PhotoProvider } from 'react-photo-view';
import { throttle } from 'lodash-es';

// Define a context interface for type safety
interface ImageContextType {
  miniMode: boolean;
}

// Create context with a default value
const ImageContext = createContext<ImageContextType>({
  miniMode: false, // Default value
});

export const useImageContext = () => useContext(ImageContext);

// Define props interface
interface ImageProviderProps {
  children: ReactNode;
}

interface FullScreenIconProps extends React.SVGProps<SVGSVGElement> {
  onClick?: () => void;
}

const FullScreenIcon = (props: FullScreenIconProps) => {
  const [fullscreen, setFullscreen] = React.useState<boolean>(false);
  React.useEffect(() => {
    document.onfullscreenchange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
  }, []);
  return (
    <svg
      className="PhotoView-Slider__toolbarIcon select-none"
      fill="white"
      width="44"
      height="44"
      viewBox="0 0 768 768"
      {...props}
    >
      {fullscreen ? (
        <path d="M511.5 256.5h96v63h-159v-159h63v96zM448.5 607.5v-159h159v63h-96v96h-63zM256.5 256.5v-96h63v159h-159v-63h96zM160.5 511.5v-63h159v159h-63v-96h-96z" />
      ) : (
        <path d="M448.5 160.5h159v159h-63v-96h-96v-63zM544.5 544.5v-96h63v159h-159v-63h96zM160.5 319.5v-159h159v63h-96v96h-63zM223.5 448.5v96h96v63h-159v-159h63z" />
      )}
    </svg>
  );
};

export default function ImageProvider({ children }: ImageProviderProps) {
  const [miniMode, setMiniMode] = useState(false);

  useEffect(() => {
    // Initial check
    const checkScreenSize = () => {
      setMiniMode(window.innerWidth < 768);
    };

    // Throttled version for performance
    const handleResize = throttle(checkScreenSize, 200);

    // Set initial value
    checkScreenSize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  function toggleFullScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const element = document.querySelector('.PhotoView-Portal');
      if (element) {
        element.requestFullscreen();
      }
    }
  }

  // Provide the context value to children
  return (
    <ImageContext.Provider value={{ miniMode }}>
      <PhotoProvider
        toolbarRender={({ rotate, onRotate, onScale, scale }) => {
          return (
            <>
              <svg
                className="PhotoView-Slider__toolbarIcon select-none"
                width="44"
                height="44"
                viewBox="0 0 768 768"
                fill="white"
                onClick={() => onScale(scale + 0.5)}
              >
                <path d="M384 640.5q105 0 180.75-75.75t75.75-180.75-75.75-180.75-180.75-75.75-180.75 75.75-75.75 180.75 75.75 180.75 180.75 75.75zM384 64.5q132 0 225.75 93.75t93.75 225.75-93.75 225.75-225.75 93.75-225.75-93.75-93.75-225.75 93.75-225.75 225.75-93.75zM415.5 223.5v129h129v63h-129v129h-63v-129h-129v-63h129v-129h63z" />
              </svg>
              <svg
                className="PhotoView-Slider__toolbarIcon select-none"
                width="44"
                height="44"
                viewBox="0 0 768 768"
                fill="white"
                onClick={() => onScale(scale - 0.5)}
              >
                <path d="M384 640.5q105 0 180.75-75.75t75.75-180.75-75.75-180.75-180.75-75.75-180.75 75.75-75.75 180.75 75.75 180.75 180.75 75.75zM384 64.5q132 0 225.75 93.75t93.75 225.75-93.75 225.75-225.75 93.75-225.75-93.75-93.75-225.75 93.75-225.75 225.75-93.75zM223.5 352.5h321v63h-321v-63z" />
              </svg>
              <svg
                className="PhotoView-Slider__toolbarIcon select-none"
                onClick={() => onRotate(rotate + 90)}
                width="44"
                height="44"
                fill="white"
                viewBox="0 0 768 768"
              >
                <path d="M565.5 202.5l75-75v225h-225l103.5-103.5c-34.5-34.5-82.5-57-135-57-106.5 0-192 85.5-192 192s85.5 192 192 192c84 0 156-52.5 181.5-127.5h66c-28.5 111-127.5 192-247.5 192-141 0-255-115.5-255-256.5s114-256.5 255-256.5c70.5 0 135 28.5 181.5 75z" />
              </svg>
              {document?.fullscreenEnabled && <FullScreenIcon onClick={toggleFullScreen} />}
            </>
          );
        }}
        children={children}
      />
    </ImageContext.Provider>
  );
}

// import "react-photo-view/dist/react-photo-view.css";
// import { PhotoView } from "react-photo-view";
import { useEffect, useRef, useState, CSSProperties } from 'react';
import m from 'medium-zoom';
import imgBoxPlaceholder from '../../public/img-box-placeholder.png';

export default function ImageBox(props: {
  src: string;
  alt: string | undefined;
  lazyLoad: boolean;
  className?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
}) {
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const hasInitRef = useRef(false);
  useEffect(() => {
    if (!error) {
      if (imgRef.current && !hasInitRef.current) {
        hasInitRef.current = true;
        m(imgRef.current);
      }
    }
  }, [error]);
  if (!error) {
    return (
      <>
        {/* <PhotoView src={props.src}> */}
        <img
          ref={imgRef}
          className={props.className}
          src={props.src}
          alt={props.alt}
          onError={() => {
            setError(true);
          }}
          width={props.width}
          height={props.height}
          style={props.style}
          loading={props.lazyLoad ? 'lazy' : undefined}
        />
        {/* </PhotoView> */}
      </>
    );
  } else {
    return (
      <img
        className={props.className}
        src={imgBoxPlaceholder.src}
        alt={props.alt}
        data-src={props.src}
        width={props.width}
        height={props.height}
        style={props.style}
        title={`图片加载失败: ${props.src}`}
        loading={props.lazyLoad ? 'lazy' : undefined}
      />
    );
  }
}

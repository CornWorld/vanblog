/// <reference types="next" />

/**
 * Type declarations for static image imports
 * Enables importing .png, .jpg, .jpeg, .gif, .webp, .svg files as modules
 * Next.js returns StaticImageData for static imports
 */

interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
  blurWidth?: number;
  blurHeight?: number;
}

declare module '*.png' {
  const value: StaticImageData;
  export default value;
}

declare module '*.jpg' {
  const value: StaticImageData;
  export default value;
}

declare module '*.jpeg' {
  const value: StaticImageData;
  export default value;
}

declare module '*.gif' {
  const value: StaticImageData;
  export default value;
}

declare module '*.webp' {
  const value: StaticImageData;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module '*.ico' {
  const value: string;
  export default value;
}

declare module '*.bmp' {
  const value: StaticImageData;
  export default value;
}

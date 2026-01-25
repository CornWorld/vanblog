export interface StaticFile {
  id: number;
  filename: string;
  path: string;
  size: number;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  hash?: string | null;
  provider?: string | null;
  createdAt: string;
}

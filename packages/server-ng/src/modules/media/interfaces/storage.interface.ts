// / <reference types="express" />

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageService {
  upload(file: Express.Multer.File, filename: string): Promise<UploadResult>;
  delete(filename: string): Promise<boolean>;
  getUrl(filename: string): string;
}

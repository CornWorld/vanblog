import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!\n Visit https://github.com/CornWorld/vanblog for more information, like API Docs, etc.';
  }
}

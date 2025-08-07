import { Module } from '@nestjs/common';

// Example plugin module that can be dynamically loaded
@Module({
  imports: [],
  controllers: [],
  providers: [],
  exports: [],
})
export class ExamplePluginModule {
  constructor() {
    console.log('ExamplePluginModule has been loaded!');
  }
}

// Export as default for dynamic loading
export default ExamplePluginModule;

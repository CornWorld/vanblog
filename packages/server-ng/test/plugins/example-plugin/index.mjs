// Test plugin example for e2e testing
// This is a simple plugin that demonstrates basic functionality

export default {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'A test plugin for e2e testing',

  // Plugin initialization
  init(context) {
    console.log('Example plugin initialized');

    // Test data storage
    context.data.set('test-key', 'test-value');

    // Test configuration reading
    const config = context.config.get('api_key', 'default-key');
    console.log('Plugin config:', config);

    // Test logging
    context.logger.info('Example plugin loaded successfully');

    return {
      status: 'success',
      message: 'Example plugin initialized',
    };
  },

  // Plugin cleanup
  destroy(context) {
    context.logger.info('Example plugin destroyed');
  },
};

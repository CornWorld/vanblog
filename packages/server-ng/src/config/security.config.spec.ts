import {
  getProductionSecurityConfig,
  getDevelopmentSecurityConfig,
  validateCorsOrigin,
  type SecurityConfig,
  type CorsValidationResult,
} from './security.config';

describe('security.config', () => {
  describe('getProductionSecurityConfig', () => {
    it('should return production security config with single origin', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config).toBeDefined();
      expect(config.cors.origin).toBe('https://example.com');
      expect(config.cors.credentials).toBe(true);
      expect(config.cors.methods).toContain('GET');
      expect(config.cors.methods).toContain('POST');
      expect(config.cors.maxAge).toBe(86400);
    });

    it('should return production security config with multiple origins', () => {
      const origins = ['https://example.com', 'https://app.example.com'];
      const config = getProductionSecurityConfig(origins);

      expect(config.cors.origin).toEqual(origins);
      expect(config.cors.credentials).toBe(true);
    });

    it('should enable CSRF in production', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.csrf.enabled).toBe(true);
      expect(config.csrf.cookieOptions.httpOnly).toBe(true);
      expect(config.csrf.cookieOptions.secure).toBe(true);
      expect(config.csrf.cookieOptions.sameSite).toBe('strict');
    });

    it('should configure strict HSTS headers', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.helmet.hsts).toBeDefined();
      if (typeof config.helmet.hsts === 'object' && config.helmet.hsts !== null) {
        expect(config.helmet.hsts.maxAge).toBe(31536000); // 1 year
        expect(config.helmet.hsts.includeSubDomains).toBe(true);
        expect(config.helmet.hsts.preload).toBe(true);
      }
    });

    it('should configure Content Security Policy', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.helmet.contentSecurityPolicy).toBeDefined();
      if (
        typeof config.helmet.contentSecurityPolicy === 'object' &&
        config.helmet.contentSecurityPolicy !== null &&
        'directives' in config.helmet.contentSecurityPolicy
      ) {
        expect(config.helmet.contentSecurityPolicy.directives).toBeDefined();
        const directives = config.helmet.contentSecurityPolicy.directives;
        if (directives && typeof directives === 'object') {
          if ('defaultSrc' in directives && Array.isArray(directives.defaultSrc)) {
            expect(directives.defaultSrc).toContain("'self'");
          }
          if ('scriptSrc' in directives && Array.isArray(directives.scriptSrc)) {
            expect(directives.scriptSrc).toContain("'self'");
          }
          if ('objectSrc' in directives && Array.isArray(directives.objectSrc)) {
            expect(directives.objectSrc).toContain("'none'");
          }
        }
      }
    });

    it('should disable crossOriginEmbedderPolicy', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.helmet.crossOriginEmbedderPolicy).toBe(false);
    });

    it('should configure strict rate limiting', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.rateLimit.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(config.rateLimit.maxRequests).toBe(100);
      expect(config.rateLimit.skipSuccessfulRequests).toBe(false);
    });

    it('should configure allowed headers', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.cors.allowedHeaders).toContain('Content-Type');
      expect(config.cors.allowedHeaders).toContain('Authorization');
      expect(config.cors.allowedHeaders).toContain('X-Requested-With');
    });

    it('should configure exposed headers', () => {
      const config = getProductionSecurityConfig('https://example.com');

      expect(config.cors.exposedHeaders).toContain('X-Total-Count');
      expect(config.cors.exposedHeaders).toContain('X-Page-Count');
    });
  });

  describe('getDevelopmentSecurityConfig', () => {
    it('should return development security config with single origin', () => {
      const config = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(config).toBeDefined();
      expect(config.cors.origin).toBe('http://localhost:3000');
      expect(config.cors.credentials).toBe(true);
    });

    it('should return development security config with multiple origins', () => {
      const origins = ['http://localhost:3000', 'http://localhost:3001'];
      const config = getDevelopmentSecurityConfig(origins);

      expect(config.cors.origin).toEqual(origins);
    });

    it('should disable CSRF in development', () => {
      const config = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(config.csrf.enabled).toBe(false);
      expect(config.csrf.cookieOptions.secure).toBe(false);
      expect(config.csrf.cookieOptions.sameSite).toBe('lax');
    });

    it('should allow unsafe-inline and unsafe-eval in CSP', () => {
      const config = getDevelopmentSecurityConfig('http://localhost:3000');

      if (
        typeof config.helmet.contentSecurityPolicy === 'object' &&
        config.helmet.contentSecurityPolicy !== null &&
        'directives' in config.helmet.contentSecurityPolicy
      ) {
        const directives = config.helmet.contentSecurityPolicy.directives;
        if (
          directives &&
          typeof directives === 'object' &&
          'scriptSrc' in directives &&
          Array.isArray(directives.scriptSrc)
        ) {
          expect(directives.scriptSrc).toContain("'unsafe-inline'");
          expect(directives.scriptSrc).toContain("'unsafe-eval'");
        }
      }
    });

    it('should not configure HSTS in development', () => {
      const config = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(config.helmet.hsts).toBeUndefined();
    });

    it('should configure relaxed rate limiting', () => {
      const config = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(config.rateLimit.windowMs).toBe(15 * 60 * 1000);
      expect(config.rateLimit.maxRequests).toBe(1000); // More permissive than production
      expect(config.rateLimit.skipSuccessfulRequests).toBe(true);
    });

    it('should have same CORS methods as production', () => {
      const devConfig = getDevelopmentSecurityConfig('http://localhost:3000');
      const prodConfig = getProductionSecurityConfig('https://example.com');

      expect(devConfig.cors.methods).toEqual(prodConfig.cors.methods);
    });

    it('should have same allowed headers as production', () => {
      const devConfig = getDevelopmentSecurityConfig('http://localhost:3000');
      const prodConfig = getProductionSecurityConfig('https://example.com');

      expect(devConfig.cors.allowedHeaders).toEqual(prodConfig.cors.allowedHeaders);
    });
  });

  describe('validateCorsOrigin', () => {
    describe('production environment', () => {
      it('should return error for wildcard origin', () => {
        const result = validateCorsOrigin('*', true);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('CRITICAL');
        expect(result.errors[0]).toContain('*');
        expect(result.errors[0]).toContain('production');
      });

      it('should return error for wildcard in origin array', () => {
        const result = validateCorsOrigin(['https://example.com', '*'], true);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('Wildcard'))).toBe(true);
      });

      it('should return warning for HTTP origins', () => {
        const result = validateCorsOrigin('http://example.com', true);

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('HTTP');
        expect(result.warnings[0]).toContain('not recommended');
        expect(result.warnings[0]).toContain('production');
      });

      it('should accept HTTPS origins without warnings', () => {
        const result = validateCorsOrigin('https://example.com', true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should validate multiple HTTPS origins successfully', () => {
        const result = validateCorsOrigin(['https://example.com', 'https://app.example.com'], true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should return multiple warnings for multiple HTTP origins', () => {
        const result = validateCorsOrigin(['http://example.com', 'http://app.example.com'], true);

        expect(result.warnings).toHaveLength(2);
        expect(result.warnings.every((w) => w.includes('HTTP'))).toBe(true);
      });

      it('should return error for invalid URL format', () => {
        const result = validateCorsOrigin('not-a-valid-url', true);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('Invalid'))).toBe(true);
      });

      it('should validate mixed valid and invalid origins', () => {
        const result = validateCorsOrigin(['https://valid.com', 'invalid-url'], true);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('Invalid'))).toBe(true);
      });
    });

    describe('development environment', () => {
      it('should not return error for wildcard origin', () => {
        const result = validateCorsOrigin('*', false);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept HTTP origins without warnings', () => {
        const result = validateCorsOrigin('http://localhost:3000', false);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should accept HTTPS origins', () => {
        const result = validateCorsOrigin('https://example.com', false);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should still validate URL format', () => {
        const result = validateCorsOrigin('not-a-valid-url', false);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((err) => err.includes('Invalid'))).toBe(true);
      });

      it('should accept localhost URLs', () => {
        const result = validateCorsOrigin(
          ['http://localhost:3000', 'http://127.0.0.1:3001'],
          false,
        );

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string origin', () => {
        const result = validateCorsOrigin('', true);

        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should handle empty array', () => {
        const result = validateCorsOrigin([], true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle origins with ports', () => {
        const result = validateCorsOrigin('https://example.com:8080', true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle origins with paths', () => {
        const result = validateCorsOrigin('https://example.com/api', true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle origins with subdomains', () => {
        const result = validateCorsOrigin('https://api.v2.example.com', true);

        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toHaveLength(0);
      });

      it('should return multiple errors for multiple invalid origins', () => {
        const result = validateCorsOrigin(['invalid1', 'invalid2', 'invalid3'], true);

        expect(result.errors.length).toBeGreaterThanOrEqual(3);
      });

      it('should handle origins with special characters', () => {
        const result = validateCorsOrigin('https://例え.com', true);

        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('SecurityConfig type compatibility', () => {
    it('should match expected SecurityConfig interface for production', () => {
      const config: SecurityConfig = getProductionSecurityConfig('https://example.com');

      expect(config).toHaveProperty('cors');
      expect(config).toHaveProperty('helmet');
      expect(config).toHaveProperty('csrf');
      expect(config).toHaveProperty('rateLimit');
    });

    it('should match expected SecurityConfig interface for development', () => {
      const config: SecurityConfig = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(config).toHaveProperty('cors');
      expect(config).toHaveProperty('helmet');
      expect(config).toHaveProperty('csrf');
      expect(config).toHaveProperty('rateLimit');
    });
  });

  describe('CorsValidationResult type compatibility', () => {
    it('should return CorsValidationResult with expected structure', () => {
      const result: CorsValidationResult = validateCorsOrigin('https://example.com', true);

      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('configuration differences between environments', () => {
    it('should have stricter CSRF settings in production', () => {
      const prodConfig = getProductionSecurityConfig('https://example.com');
      const devConfig = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(prodConfig.csrf.enabled).toBe(true);
      expect(devConfig.csrf.enabled).toBe(false);
      expect(prodConfig.csrf.cookieOptions.secure).toBe(true);
      expect(devConfig.csrf.cookieOptions.secure).toBe(false);
      expect(prodConfig.csrf.cookieOptions.sameSite).toBe('strict');
      expect(devConfig.csrf.cookieOptions.sameSite).toBe('lax');
    });

    it('should have stricter CSP in production', () => {
      const prodConfig = getProductionSecurityConfig('https://example.com');
      const devConfig = getDevelopmentSecurityConfig('http://localhost:3000');

      // Check production CSP
      if (
        typeof prodConfig.helmet.contentSecurityPolicy === 'object' &&
        prodConfig.helmet.contentSecurityPolicy !== null &&
        'directives' in prodConfig.helmet.contentSecurityPolicy
      ) {
        const prodDirectives = prodConfig.helmet.contentSecurityPolicy.directives;
        if (
          prodDirectives &&
          typeof prodDirectives === 'object' &&
          'scriptSrc' in prodDirectives &&
          Array.isArray(prodDirectives.scriptSrc)
        ) {
          expect(prodDirectives.scriptSrc).not.toContain("'unsafe-eval'");
        }
      }

      // Check development CSP
      if (
        typeof devConfig.helmet.contentSecurityPolicy === 'object' &&
        devConfig.helmet.contentSecurityPolicy !== null &&
        'directives' in devConfig.helmet.contentSecurityPolicy
      ) {
        const devDirectives = devConfig.helmet.contentSecurityPolicy.directives;
        if (
          devDirectives &&
          typeof devDirectives === 'object' &&
          'scriptSrc' in devDirectives &&
          Array.isArray(devDirectives.scriptSrc)
        ) {
          expect(devDirectives.scriptSrc).toContain("'unsafe-eval'");
        }
      }
    });

    it('should have stricter rate limiting in production', () => {
      const prodConfig = getProductionSecurityConfig('https://example.com');
      const devConfig = getDevelopmentSecurityConfig('http://localhost:3000');

      expect(prodConfig.rateLimit.maxRequests).toBeLessThan(devConfig.rateLimit.maxRequests);
      expect(prodConfig.rateLimit.skipSuccessfulRequests).toBe(false);
      expect(devConfig.rateLimit.skipSuccessfulRequests).toBe(true);
    });
  });
});

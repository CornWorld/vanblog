import { describe, it, expect } from 'vitest';
import { Roles, ROLES_KEY } from './roles.decorator';
import { Perm, Permission, PERMISSION_KEY, type PermOptions } from './permissions.decorator';

describe('Roles Decorator', () => {
  it('should set roles metadata', () => {
    // Create a simple test function
    class TestClass {
      @Roles('admin')
      testMethod(): void {
        // method body
      }
    }

    // Get the metadata from the decorated method
    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.testMethod);

    expect(metadata).toBeDefined();
    expect(metadata).toContain('admin');
  });

  it('should set multiple roles', (): void => {
    class TestClass {
      @Roles('admin', 'editor')
      testMethod(): void {
        // method body
      }
    }

    const metadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.testMethod);

    expect(metadata).toBeDefined();
    expect(metadata).toHaveLength(2);
    expect(metadata).toContain('admin');
    expect(metadata).toContain('editor');
  });

  it('should work as a decorator', () => {
    const decorator = Roles('admin');

    expect(typeof decorator).toBe('function');
  });
});

describe('Perm Decorator', () => {
  it('should set permission metadata with string array', (): void => {
    class TestClass {
      @Perm('article:read', 'article:write')
      testMethod(): void {
        // method body
      }
    }

    const metadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.testMethod);

    expect(metadata).toBeDefined();
    expect(metadata).toContain('article:read');
    expect(metadata).toContain('article:write');
  });

  it('should set permission metadata with module tuple format', (): void => {
    class TestClass {
      @Perm('article', ['read', 'write'])
      testMethod(): void {
        // method body
      }
    }

    const metadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.testMethod);

    expect(metadata).toBeDefined();
    expect(metadata).toContain('article:read');
    expect(metadata).toContain('article:write');
  });

  it('should set permission metadata with options object', () => {
    const options: PermOptions = {
      perms: ['article:read'],
      roles: ['admin'],
      authOnly: true,
    };

    class TestClass {
      @Perm(options)
      testMethod(): void {
        // method body
      }
    }

    const permMetadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.testMethod);
    const roleMetadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.testMethod);

    expect(permMetadata).toBeDefined();
    expect(permMetadata).toContain('article:read');
    expect(roleMetadata).toBeDefined();
    expect(roleMetadata).toContain('admin');
  });

  it('Permission should be an alias for Perm', () => {
    expect(Permission).toBe(Perm);
  });

  it('should work without any arguments', (): void => {
    class TestClass {
      @Perm()
      testMethod(): void {
        // method body
      }
    }

    expect(TestClass.prototype.testMethod).toBeDefined();
  });

  it('should handle single permission string in array', (): void => {
    class TestClass {
      @Perm('article:read')
      testMethod(): void {
        // method body
      }
    }

    const metadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.testMethod);

    expect(metadata).toBeDefined();
    if (metadata) {
      expect(metadata).toContain('article:read');
    }
  });

  it('should apply decorator to class methods', (): void => {
    class TestClass {
      @Perm('user:delete')
      deleteUser(): string {
        return 'deleted';
      }

      @Perm('user:create')
      createUser(): string {
        return 'created';
      }
    }

    const deleteMetadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.deleteUser);
    const createMetadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.createUser);

    expect(deleteMetadata).toContain('user:delete');
    expect(createMetadata).toContain('user:create');
  });

  it('should normalize module-based permissions', (): void => {
    class TestClass {
      @Perm('category', ['create', 'update', 'delete'])
      manageCategories(): void {
        // method body
      }
    }

    const metadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.manageCategories);

    expect(metadata).toBeDefined();
    expect(metadata).toContain('category:create');
    expect(metadata).toContain('category:update');
    expect(metadata).toContain('category:delete');
  });

  it('should handle empty permission arrays', () => {
    const options: PermOptions = {
      perms: [],
      roles: [],
    };

    const decorator = Perm(options);

    expect(typeof decorator).toBe('function');
  });

  it('should handle mixed role and permission options', () => {
    const options: PermOptions = {
      perms: ['article:publish'],
      roles: ['editor'],
      authOnly: false,
    };

    class TestClass {
      @Perm(options)
      publishArticle(): string {
        return 'published';
      }
    }

    const permMetadata = Reflect.getMetadata(PERMISSION_KEY, TestClass.prototype.publishArticle);
    const roleMetadata = Reflect.getMetadata(ROLES_KEY, TestClass.prototype.publishArticle);

    expect(permMetadata).toBeDefined();
    expect(roleMetadata).toBeDefined();
  });
});

describe('Decorator Type Safety', () => {
  it('Roles decorator should return a proper decorator function', () => {
    const decorator = Roles('admin');

    expect(typeof decorator).toBe('function');
    expect(decorator.length).toBeGreaterThanOrEqual(0);
  });

  it('Perm decorator should return a proper decorator function', () => {
    const decorator = Perm('article:read');

    expect(typeof decorator).toBe('function');
  });
});

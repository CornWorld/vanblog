import * as vm from 'vm';

import { Injectable, NotFoundException, Logger, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, like, desc, sql } from 'drizzle-orm';

import { DATABASE_CONNECTION } from '../../../database';
import { codeSnippets } from '../../../database/schema';
import {
  CreateCodeSnippetDto,
  UpdateCodeSnippetDto,
  CodeSnippetQueryDto,
  CodeSnippetExecuteDto,
  CodeSnippetListResponseDto,
  CodeSnippetExecuteResponseDto,
  CodeSnippetResponseDto,
} from '../dto/code-snippet.dto';
import { NewCodeSnippet } from '../entities/code-snippet.entity';

import { PluginContextFactory } from './plugin-context.service';

import type { Database } from '../../../database/connection';

@Injectable()
export class CodeSnippetService {
  private readonly logger = new Logger(CodeSnippetService.name);

  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: Database,
    private readonly pluginContextFactory: PluginContextFactory,
  ) {}

  async create(createCodeSnippetDto: CreateCodeSnippetDto): Promise<CodeSnippetResponseDto> {
    try {
      // Validate the code syntax by trying to compile it
      this.validateCodeSyntax(createCodeSnippetDto.code);

      const newCodeSnippet: NewCodeSnippet = {
        name: createCodeSnippetDto.name,
        description: createCodeSnippetDto.description,
        hookName: createCodeSnippetDto.hookName,
        hookType: createCodeSnippetDto.hookType,
        priority: createCodeSnippetDto.priority,
        code: createCodeSnippetDto.code,
        enabled: createCodeSnippetDto.enabled,
        timeout: createCodeSnippetDto.timeout,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await this.db.insert(codeSnippets).values(newCodeSnippet).returning();

      if (!result[0]) {
        throw new Error('Failed to create code snippet');
      }

      this.logger.log(`Created code snippet: ${result[0].name}`);
      const snippet = result[0];
      return {
        id: snippet.id,
        name: snippet.name,
        description: snippet.description,
        hookName: snippet.hookName,
        hookType: snippet.hookType,
        priority: snippet.priority,
        code: snippet.code,
        enabled: snippet.enabled,
        timeout: snippet.timeout,
        createdAt: snippet.createdAt.toISOString(),
        updatedAt: snippet.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to create code snippet:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async findAll(query: CodeSnippetQueryDto): Promise<CodeSnippetListResponseDto> {
    try {
      const { page = 1, limit = 10, hookName, hookType, enabled, search } = query;
      const offset = (page - 1) * limit;

      const whereConditions = [];

      if (hookName) {
        whereConditions.push(eq(codeSnippets.hookName, hookName));
      }

      if (hookType) {
        whereConditions.push(eq(codeSnippets.hookType, hookType));
      }

      if (enabled !== undefined) {
        whereConditions.push(eq(codeSnippets.enabled, enabled));
      }

      if (search) {
        whereConditions.push(like(codeSnippets.name, `%${search}%`));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Get total count
      const totalResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(codeSnippets)
        .where(whereClause);

      const total = totalResult[0]?.count ?? 0;

      // Get paginated data
      const data = await this.db
        .select()
        .from(codeSnippets)
        .where(whereClause)
        .orderBy(desc(codeSnippets.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        data: data.map((snippet) => ({
          id: snippet.id,
          name: snippet.name,
          description: snippet.description,
          hookName: snippet.hookName,
          hookType: snippet.hookType,
          priority: snippet.priority,
          code: snippet.code,
          enabled: snippet.enabled,
          timeout: snippet.timeout,
          createdAt: snippet.createdAt.toISOString(),
          updatedAt: snippet.updatedAt.toISOString(),
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error(
        `Failed to find code snippets:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async findOne(id: number): Promise<CodeSnippetResponseDto> {
    try {
      const result = await this.db
        .select()
        .from(codeSnippets)
        .where(eq(codeSnippets.id, id))
        .limit(1);

      if (!result[0]) {
        throw new NotFoundException(`Code snippet with ID ${String(id)} not found`);
      }

      const snippet = result[0];
      return {
        id: snippet.id,
        name: snippet.name,
        description: snippet.description,
        hookName: snippet.hookName,
        hookType: snippet.hookType,
        priority: snippet.priority,
        code: snippet.code,
        enabled: snippet.enabled,
        timeout: snippet.timeout,
        createdAt: snippet.createdAt.toISOString(),
        updatedAt: snippet.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to find code snippet with ID ${String(id)}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async update(
    id: number,
    updateCodeSnippetDto: UpdateCodeSnippetDto,
  ): Promise<CodeSnippetResponseDto> {
    try {
      // Validate the code syntax if code is being updated
      if (updateCodeSnippetDto.code) {
        this.validateCodeSyntax(updateCodeSnippetDto.code);
      }

      const result = await this.db
        .update(codeSnippets)
        .set({
          ...(updateCodeSnippetDto.name && { name: updateCodeSnippetDto.name }),
          ...(updateCodeSnippetDto.description !== undefined && {
            description: updateCodeSnippetDto.description,
          }),
          ...(updateCodeSnippetDto.hookName && { hookName: updateCodeSnippetDto.hookName }),
          ...(updateCodeSnippetDto.hookType && { hookType: updateCodeSnippetDto.hookType }),
          ...(updateCodeSnippetDto.priority !== undefined && {
            priority: updateCodeSnippetDto.priority,
          }),
          ...(updateCodeSnippetDto.code && { code: updateCodeSnippetDto.code }),
          ...(updateCodeSnippetDto.enabled !== undefined && {
            enabled: updateCodeSnippetDto.enabled,
          }),
          ...(updateCodeSnippetDto.timeout !== undefined && {
            timeout: updateCodeSnippetDto.timeout,
          }),
          updatedAt: new Date(),
        })
        .where(eq(codeSnippets.id, id))
        .returning();

      if (!result[0]) {
        throw new NotFoundException(`Code snippet with ID ${String(id)} not found`);
      }

      this.logger.log(`Updated code snippet: ${result[0].name}`);
      const snippet = result[0];
      return {
        id: snippet.id,
        name: snippet.name,
        description: snippet.description,
        hookName: snippet.hookName,
        hookType: snippet.hookType,
        priority: snippet.priority,
        code: snippet.code,
        enabled: snippet.enabled,
        timeout: snippet.timeout,
        createdAt: snippet.createdAt.toISOString(),
        updatedAt: snippet.updatedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to update code snippet with ID ${String(id)}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    try {
      const result = await this.db.delete(codeSnippets).where(eq(codeSnippets.id, id)).returning();

      if (!result[0]) {
        throw new NotFoundException(`Code snippet with ID ${String(id)} not found`);
      }

      this.logger.log(`Deleted code snippet: ${result[0].name}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete code snippet with ID ${String(id)}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async execute(
    id: number,
    executeDto: CodeSnippetExecuteDto,
  ): Promise<CodeSnippetExecuteResponseDto> {
    const startTime = Date.now();

    try {
      const snippet = await this.findOne(id);

      if (!snippet.enabled) {
        throw new BadRequestException('Code snippet is disabled');
      }

      const result = await this.executeCode(
        snippet.code,
        executeDto.data,
        executeDto.args ?? [],
        snippet.timeout,
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        result,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to execute code snippet with ID ${String(id)}:`, errorMessage);

      return {
        success: false,
        error: errorMessage,
        executionTime,
      };
    }
  }

  async findByHook(
    hookName: string,
    hookType: 'action' | 'filter',
  ): Promise<CodeSnippetResponseDto[]> {
    try {
      const result = await this.db
        .select()
        .from(codeSnippets)
        .where(
          and(
            eq(codeSnippets.hookName, hookName),
            eq(codeSnippets.hookType, hookType),
            eq(codeSnippets.enabled, true),
          ),
        )
        .orderBy(codeSnippets.priority);

      return result.map((snippet) => ({
        id: snippet.id,
        name: snippet.name,
        description: snippet.description,
        hookName: snippet.hookName,
        hookType: snippet.hookType,
        priority: snippet.priority,
        code: snippet.code,
        enabled: snippet.enabled,
        timeout: snippet.timeout,
        createdAt: snippet.createdAt.toISOString(),
        updatedAt: snippet.updatedAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error(
        `Failed to find code snippets for hook ${hookName}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async executeCode(
    code: string,
    data?: unknown,
    args: unknown[] = [],
    timeout = 5000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Code execution timed out after ${String(timeout)}ms`));
      }, timeout);

      try {
        // Create a safe execution context
        const context = {
          data,
          args,
          console: {
            log: (...args: unknown[]) => {
              this.logger.debug('Code snippet log:', ...args);
            },
            error: (...args: unknown[]) => {
              this.logger.error('Code snippet error:', ...args);
            },
            warn: (...args: unknown[]) => {
              this.logger.warn('Code snippet warn:', ...args);
            },
          },
          setTimeout: (fn: () => void, delay: number) => {
            if (delay > timeout) {
              throw new Error('setTimeout delay cannot exceed snippet timeout');
            }
            return setTimeout(fn, delay);
          },
          // Add plugin context if needed
          context: this.pluginContextFactory.createContext('code-snippet'),
        };

        // Create VM context
        const vmContext = vm.createContext(context);

        // Wrap code in a function that returns the result
        const wrappedCode = `
          (function() {
            ${code}
          })()
        `;

        const result = vm.runInContext(wrappedCode, vmContext, {
          timeout,
          displayErrors: true,
        }) as unknown;

        clearTimeout(timer);
        resolve(result);
      } catch (error) {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private validateCodeSyntax(code: string): void {
    try {
      // Try to compile the code to check syntax
      vm.compileFunction(code, []);
    } catch (error) {
      throw new BadRequestException(
        `Invalid JavaScript syntax: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

import { fork, ChildProcess } from 'child_process';
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { Injectable, NotFoundException, Inject, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { pipelines } from '@vanblog/shared/drizzle';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

import { DATABASE_CONNECTION, type Database } from '../../database';

import {
  CreatePipelineSchema,
  UpdatePipelineSchema,
  PipelineListResponseSchema,
  PipelineSchema,
  type Pipeline,
  type PipelineExecutionResult,
} from './dto/pipeline.dto';

/**
 * Pipeline Service
 *
 * Manages pipelines - JavaScript code snippets that can be triggered by system events.
 * Provides CRUD operations and execution capabilities.
 */
@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private readonly runnerPath: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: Database,
    private readonly configService: ConfigService,
  ) {
    // Initialize runner path from config or use default
    this.runnerPath = this.configService.get<string>(
      'pipeline.runnerPath',
      join(process.cwd(), 'data', 'pipeline-scripts'),
    );
    this.ensureRunnerDirectoryExists();
  }

  /**
   * Ensure the runner directory exists
   */
  private ensureRunnerDirectoryExists(): void {
    if (!existsSync(this.runnerPath)) {
      mkdirSync(this.runnerPath, { recursive: true });
      this.logger.log(`Created pipeline runner directory: ${this.runnerPath}`);
    }
  }

  /**
   * Find all pipelines (excluding deleted ones)
   */
  async findAll(): Promise<z.infer<typeof PipelineListResponseSchema>> {
    const results = await this.db
      .select()
      .from(pipelines)

      .where(eq(pipelines.deleted, false))

      .orderBy(desc(pipelines.createdAt));

    return {
      items: results,
      total: results.length,
    };
  }

  /**
   * Find pipeline by ID
   */
  async findOne(id: number): Promise<z.infer<typeof PipelineSchema>> {
    const results = await this.db
      .select()
      .from(pipelines)
      .where(
        and(
          eq(pipelines.id, id),

          eq(pipelines.deleted, false),
        ),
      );

    const pipeline = results[0] as z.infer<typeof PipelineSchema> | undefined;
    if (pipeline === undefined) {
      throw new NotFoundException(`Pipeline with ID ${String(id)} not found`);
    }

    return pipeline;
  }

  /**
   * Find pipelines by event name
   */
  async findByEventName(eventName: string): Promise<Pipeline[]> {
    return await this.db
      .select()
      .from(pipelines)
      .where(
        and(
          eq(pipelines.eventName, eventName),

          eq(pipelines.deleted, false),

          eq(pipelines.enabled, true),
        ),
      );
  }

  /**
   * Create a new pipeline
   */
  async create(
    createDto: z.infer<typeof CreatePipelineSchema>,
  ): Promise<z.infer<typeof PipelineSchema>> {
    this.logger.log(`Creating pipeline: ${createDto.name}`);

    // Validate event name
    this.validateEventName(createDto.eventName);

    // Validate script content for security
    if (createDto.script) {
      this.validateScriptContent(createDto.script);
    }

    // Set default script if empty
    let { script } = createDto;
    if (!script || !script.trim()) {
      script = `
// Async task - use await at top level
// Access input data via 'input' variable
// Modify input directly - it will be returned after script execution
// Note: 'input' contains pipeline input data
`;
    }

    const [newPipeline] = await this.db
      .insert(pipelines)
      .values({
        ...createDto,
        script,
      })
      .returning();

    // Save script to runner path

    this.saveOrUpdateScriptToRunnerPath(newPipeline.id, newPipeline.script);

    this.logger.log(`Created pipeline: ${String(newPipeline.id)} - ${newPipeline.name}`);

    return newPipeline;
  }

  /**
   * Update a pipeline
   */
  async update(
    id: number,
    updateDto: z.infer<typeof UpdatePipelineSchema>,
  ): Promise<z.infer<typeof PipelineSchema>> {
    this.logger.log(`Updating pipeline: ${String(id)}`);

    // Check if pipeline exists
    await this.findOne(id);

    // Validate event name if provided
    if (updateDto.eventName) {
      this.validateEventName(updateDto.eventName);
    }

    // Validate script content for security if provided
    if (updateDto.script) {
      this.validateScriptContent(updateDto.script);
    }

    const [updatedPipeline] = await this.db
      .update(pipelines)
      .set({
        ...updateDto,
        updatedAt: new Date().toISOString(),
      })

      .where(eq(pipelines.id, id))
      .returning();

    // Update script file if script changed
    if (updateDto.script) {
      this.saveOrUpdateScriptToRunnerPath(id, updateDto.script);
    }

    this.logger.log(`Updated pipeline: ${String(id)}`);

    return updatedPipeline;
  }

  /**
   * Delete a pipeline (soft delete)
   */
  async remove(id: number): Promise<void> {
    this.logger.log(`Deleting pipeline: ${String(id)}`);

    // Check if pipeline exists
    await this.findOne(id);

    await this.db.update(pipelines).set({ deleted: true }).where(eq(pipelines.id, id));

    // Delete script file
    this.deleteScriptById(id);

    this.logger.log(`Deleted pipeline: ${String(id)}`);
  }

  /**
   * Trigger a pipeline by ID
   */
  async triggerById(id: number, input: unknown): Promise<PipelineExecutionResult> {
    this.logger.log(`Triggering pipeline: ${String(id)}`);

    // Validate input data for security
    this.validateInputData(input);

    const pipeline = await this.findOne(id);

    if (!pipeline.enabled) {
      throw new BadRequestException(`Pipeline ${String(id)} is disabled`);
    }

    const result = await this.runCodeByPipelineId(id, input);

    return result;
  }

  /**
   * Dispatch event to all pipelines listening to it
   */
  async dispatchEvent(eventName: string, data?: unknown): Promise<PipelineExecutionResult[]> {
    // Validate input data for security
    this.validateInputData(data);

    const eventPipelines = await this.findByEventName(eventName);
    const results: PipelineExecutionResult[] = [];

    this.logger.log(
      `Dispatching event '${eventName}' to ${String(eventPipelines.length)} pipelines`,
    );

    for (const pipeline of eventPipelines) {
      try {
        const result = await this.runCodeByPipelineId(pipeline.id, data);
        results.push(result);
      } catch (err) {
        const pipelineId = pipeline.id;
        this.logger.error(
          `Pipeline ${String(pipelineId)} execution failed:`,
          err instanceof Error ? err : new Error(String(err)),
        );
        results.push({
          status: 'error',
          logs: [err instanceof Error ? err.message : String(err)],
          output: null,
        });
      }
    }

    return results;
  }

  /**
   * Get pipeline config (available event names)
   */
  getConfig(): { events: string[] } {
    // Get available event names from hook service or return default list
    const defaultEvents = [
      'article|beforeCreate',
      'article|afterCreate',
      'article|beforeUpdate',
      'article|afterUpdate',
      'article|afterDelete',
      'draft|afterPublish',
      'user|afterCreate',
      'user|afterUpdate',
      'setting|afterUpdate',
    ];

    return { events: defaultEvents };
  }

  /**
   * Execute pipeline code
   */
  private async runCodeByPipelineId(id: number, data: unknown): Promise<PipelineExecutionResult> {
    const pipeline = await this.findOne(id);
    const traceId = new Date().getTime();

    this.logger.log(`[${String(traceId)}] Running pipeline: ${String(id)} - ${pipeline.name}`);

    await this.db.update(pipelines).set({ status: 'running' }).where(eq(pipelines.id, id));

    const scriptPath = this.getPathById(id);

    try {
      const result = await this.executeScript(scriptPath, data);

      // Update pipeline status on success
      await this.db
        .update(pipelines)
        .set({
          status: 'success',
          lastRun: new Date().toISOString(),
          lastStatus: 'success',
          lastError: null,
        })

        .where(eq(pipelines.id, id));

      this.logger.log(`[${String(traceId)}] Pipeline ${String(id)} completed successfully`);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Update pipeline status on error
      await this.db
        .update(pipelines)
        .set({
          status: 'error',
          lastRun: new Date().toISOString(),
          lastStatus: 'error',
          lastError: error.message,
        })

        .where(eq(pipelines.id, id));

      this.logger.error(`[${String(traceId)}] Pipeline ${String(id)} failed:`, error);

      throw error;
    } finally {
      // Reset status to idle
      setTimeout(() => {
        void this.db.update(pipelines).set({ status: 'idle' }).where(eq(pipelines.id, id));
      }, 1000);
    }
  }

  /**
   * Execute script in child process with resource limits
   */
  private executeScript(scriptPath: string, data: unknown): Promise<PipelineExecutionResult> {
    return new Promise((resolve, reject) => {
      // Set execution timeout (configurable, default 30s)
      const timeoutMs = this.configService.get<number>('pipeline.timeout', 30000);

      const subProcess: ChildProcess = fork(scriptPath, {
        // Use silent mode to control stdio
        silent: false,
        // Set exec arguments to enable strict mode and security restrictions
        execArgv: [
          '--use-strict',
          '--no-deprecation',
          '--no-warnings',
          '--disable-proto=delete',
          '--disallow-code-generation-from-strings',
        ],
      });

      // eslint-disable-next-line prefer-const
      let timeoutHandle: NodeJS.Timeout | undefined;

      // Clear timeout and cleanup
      const cleanup = (): void => {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        if (!subProcess.killed) {
          subProcess.kill('SIGTERM');
        }
      };

      // Send data to child process
      try {
        subProcess.send(data ?? {});
      } catch (sendError) {
        cleanup();
        reject(new Error(`Failed to send data to pipeline process: ${String(sendError)}`));
        return;
      }

      // Handle messages from child process
      subProcess.on('message', (msg: PipelineExecutionResult) => {
        cleanup();

        if (msg.status === 'error') {
          reject(new Error(msg.logs.join('\n')));
        } else {
          resolve(msg);
        }
      });

      // Handle child process errors
      subProcess.on('error', (error) => {
        cleanup();
        this.logger.error(`Pipeline process error: ${error.message}`);
        reject(error);
      });

      // Handle child process exit
      subProcess.on('exit', (code, signal) => {
        cleanup();

        // If process exited with error code and wasn't killed by our timeout
        if (code !== 0 && code !== null && signal !== 'SIGTERM') {
          reject(new Error(`Pipeline process exited with code ${String(code)}`));
        }
      });

      // Set timeout handler
      timeoutHandle = setTimeout(() => {
        cleanup();
        this.logger.warn(`Pipeline execution timeout after ${String(timeoutMs)}ms`);
        reject(new Error(`Pipeline execution timeout after ${String(timeoutMs)}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Validate event name
   */
  private validateEventName(eventName: string): void {
    // For now, we allow any event name
    // In the future, we can validate against the config.events list
    if (!eventName || !eventName.trim()) {
      throw new BadRequestException('Event name is required');
    }
  }

  /**
   * Validate and sanitize script content for security
   * Blocks dangerous patterns that could lead to code injection
   */
  private validateScriptContent(script: string): void {
    const dangerousPatterns = [
      // Direct eval and Function constructor
      { pattern: /\beval\s*\(/, name: 'eval()' },
      { pattern: /new\s+Function\s*\(/, name: 'new Function()' },

      // Process manipulation
      { pattern: /\bprocess\.\w+\s*=/, name: 'process modification' },
      { pattern: /process\.exit\(/, name: 'process.exit()' },
      { pattern: /process\.kill\(/, name: 'process.kill()' },

      // Child process spawning
      {
        pattern: /require\s*\(\s*['"](child_process|exec|spawn|fork)['"]\s*\)/,
        name: 'child_process require',
      },
      { pattern: /\b(exec|spawn|execSync)\s*\(/, name: 'process execution' },

      // File system operations (beyond what's allowed)
      { pattern: /require\s*\(\s*['"]fs['"]\s*\)/, name: 'fs module require' },

      // Network operations
      { pattern: /require\s*\(\s*['"](net|http|https)['"]\s*\)/, name: 'network module require' },

      // Module system manipulation
      { pattern: /require\s*\(\s*['"]module['"]\s*\)/, name: 'module require' },
      { pattern: /\b__dirname\b/, name: '__dirname' },
      { pattern: /\b__filename\b/, name: '__filename' },

      // Immediate invocation to bypass restrictions
      { pattern: /\(\s*function\s*\(/, name: 'IIFE pattern' },
    ];

    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(script)) {
        this.logger.warn(`Blocked dangerous script pattern: ${name}`);
        throw new BadRequestException(
          `Script contains forbidden pattern: ${name}. For security reasons, this operation is not allowed in pipeline scripts.`,
        );
      }
    }

    // Check for require statements with dynamic arguments
    if (/require\s*\(/.test(script) && !/require\s*\(\s*['"][^'"]+['"]\s*\)/.test(script)) {
      throw new BadRequestException('Dynamic require() calls are not allowed for security reasons');
    }
  }

  /**
   * Validate and sanitize input data
   */
  private validateInputData(data: unknown): void {
    if (data === null || data === undefined) {
      return; // Empty input is valid
    }

    // Ensure data is a plain object or array
    const dataType = typeof data;
    if (dataType !== 'object') {
      throw new BadRequestException(
        `Pipeline input must be an object or array, received ${dataType}`,
      );
    }

    // Check for circular references (basic check)
    try {
      JSON.stringify(data);
    } catch {
      throw new BadRequestException(
        'Pipeline input contains circular references or non-serializable data',
      );
    }

    // Limit input size (1MB)
    const dataSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
    const maxSize = 1024 * 1024; // 1MB
    if (dataSize > maxSize) {
      throw new BadRequestException(`Pipeline input size exceeds ${String(maxSize)} bytes limit`);
    }
  }

  /**
   * Get script file path by pipeline ID
   */
  private getPathById(id: number): string {
    return join(this.runnerPath, `${String(id)}.js`);
  }

  /**
   * Save or update script to runner path
   */
  private saveOrUpdateScriptToRunnerPath(id: number, script: string): void {
    const filePath = this.getPathById(id);

    // Wrap user script in execution environment
    const scriptToSave = `
'use strict';

// Security: Restrict global access
const restrictedGlobals = ['eval', 'Function', 'process', 'require', 'module', '__dirname', '__filename'];
restrictedGlobals.forEach(name => {
  try {
    delete global[name];
  } catch(e) {
    // Some globals cannot be deleted, so we override them
    global[name] = undefined;
  }
});

// Define safe execution context
let input = {};
let logs = [];
const oldLog = console.log;

// Safe console.log wrapper
console.log = (...args) => {
  const logArr = [];
  for (const each of args) {
    if (typeof each === 'object') {
      try {
        logArr.push(JSON.stringify(each, null, 2));
      } catch(e) {
        logArr.push(String(each));
      }
    } else {
      logArr.push(each);
    }
  }
  logs.push(logArr.join(" "));
  oldLog(...args);
};

// Process message handler with timeout protection
process.on('message', async (msg) => {
  // Validate input is an object
  if (msg && typeof msg === 'object') {
    input = msg;
  }

  try {
    // Execute user script
    ${script}

    // Send success response
    process.send({
      status: 'success',
      output: input,
      logs,
    });
  } catch(err) {
    // Send error response
    process.send({
      status: 'error',
      output: null,
      logs: [...logs, err.message || String(err)],
    });
  }
});
    `;

    writeFileSync(filePath, scriptToSave, { encoding: 'utf-8' });
    this.logger.log(`Saved script for pipeline ${String(id)} to ${filePath}`);
  }

  /**
   * Delete script file by pipeline ID
   */
  private deleteScriptById(id: number): void {
    const filePath = this.getPathById(id);
    try {
      if (existsSync(filePath)) {
        rmSync(filePath);
        this.logger.log(`Deleted script for pipeline ${String(id)}`);
      }
    } catch (err) {
      this.logger.error(
        `Failed to delete script for pipeline ${String(id)}:`,
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }
}

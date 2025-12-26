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

    // Set default script if empty
    let { script } = createDto;
    if (!script || !script.trim()) {
      script = `
// Async task - use await at top level
// Access input data via 'input' variable
// Modify input directly - it will be returned after script execution

console.log('Pipeline executed with input:', input);
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
   * Execute script in child process
   */
  private executeScript(scriptPath: string, data: unknown): Promise<PipelineExecutionResult> {
    return new Promise((resolve, reject) => {
      const subProcess: ChildProcess = fork(scriptPath);

      // Send data to child process
      subProcess.send(data || {});

      // Handle messages from child process
      subProcess.on('message', (msg: PipelineExecutionResult) => {
        if (msg.status === 'error') {
          subProcess.kill('SIGINT');
          reject(new Error(msg.logs.join('\n')));
        } else {
          resolve(msg);
        }
      });

      // Handle child process errors
      subProcess.on('error', (error) => {
        reject(error);
      });

      // Handle child process exit
      subProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Process exited with code ${String(code)}`));
        }
      });

      // Set timeout
      setTimeout(() => {
        subProcess.kill('SIGTERM');
        reject(new Error('Pipeline execution timeout'));
      }, 30000); // 30 seconds timeout
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
let input = {};
let logs = [];
const oldLog = console.log;
console.log = (...args) => {
  const logArr = [];
  for (const each of args) {
    if (typeof each === 'object') {
      logArr.push(JSON.stringify(each, null, 2));
    } else {
      logArr.push(each);
    }
  }
  logs.push(logArr.join(" "));
  oldLog(...args);
};

process.on('message', async (msg) => {
  input = msg;
  try {
    ${script}
    process.send({
      status: 'success',
      output: input,
      logs,
    });
  } catch(err) {
    process.send({
      status: 'error',
      output: err,
      logs: [...logs, err.message],
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

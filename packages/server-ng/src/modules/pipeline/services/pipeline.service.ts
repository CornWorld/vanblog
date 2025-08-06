import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../database';
import type { Database } from '../../../database/connection';
import { pipelines, Pipeline, NewPipeline } from '../entities/pipeline.entity';
import { CreatePipelineDto, UpdatePipelineDto } from '../dto';
import { VanblogSystemEventNames, VanblogSystemEvent } from '../../../shared/types/event';
import { writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { fork, spawnSync } from 'child_process';
import { join } from 'path';

export interface CodeResult {
  logs: string[];
  output: unknown;
  status: 'success' | 'error';
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private idLock = false;
  private readonly runnerPath: string;

  constructor(@Inject(DATABASE_CONNECTION) private readonly db: Database) {
    this.runnerPath = process.env.CODE_RUNNER_PATH ?? './data/pipeline-scripts';
    // Only initialize in production environment
    if (process.env.NODE_ENV !== 'test') {
      void this.init();
    }
  }

  // Public methods
  async create(createPipelineDto: CreatePipelineDto): Promise<Pipeline> {
    if (!this.checkEvent(createPipelineDto.eventName)) {
      throw new NotFoundException('Event not found in VanblogEventNames');
    }

    const id = await this.getNewId();
    let script = createPipelineDto.script;

    if (!script || script.trim() === '') {
      script = `
// 异步任务，请在脚本顶层使用 await，不然会直接被忽略
// 请使用 input 变量获取数据（如果有）
// 直接修改 input 里的内容即可
// 脚本结束后 input 将被返回

`;
    }

    const newPipeline: NewPipeline = {
      id,
      name: createPipelineDto.name,
      description: createPipelineDto.description,
      enabled: createPipelineDto.enabled ?? true,
      eventName: createPipelineDto.eventName,
      script,
      deps: JSON.stringify(createPipelineDto.deps ?? []),
      eventType: createPipelineDto.eventType ?? 'system',
    };

    try {
      const results = await this.db.insert(pipelines).values(newPipeline).returning();
      if (results.length === 0) {
        throw new Error('Failed to create pipeline');
      }
      const result = results[0];

      // Save script to file system
      this.saveOrUpdateScriptToRunnerPath(result.id, result.script);

      // Install dependencies if any
      const deps: string[] = result.deps ? (JSON.parse(result.deps) as string[]) : [];
      if (deps.length > 0) {
        this.addDeps(deps);
      }

      return result;
    } catch (error) {
      this.logger.error(
        'Failed to create pipeline:',
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async findAll(): Promise<Pipeline[]> {
    const results = await this.db.select().from(pipelines).where(eq(pipelines.deleted, false));
    return results as Pipeline[];
  }

  async findOne(id: number): Promise<Pipeline> {
    const results = await this.db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.id, id), eq(pipelines.deleted, false)));

    if (results.length === 0) {
      throw new NotFoundException(`Pipeline with ID ${String(id)} not found`);
    }

    return results[0] as Pipeline;
  }

  async findByEvent(eventName: string): Promise<Pipeline[]> {
    const results = await this.db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.eventName, eventName), eq(pipelines.deleted, false)));
    return results as Pipeline[];
  }

  async update(id: number, updatePipelineDto: UpdatePipelineDto): Promise<Pipeline> {
    await this.findOne(id); // Verify pipeline exists

    if (updatePipelineDto.eventName && !this.checkEvent(updatePipelineDto.eventName)) {
      throw new NotFoundException('Event not found in VanblogEventNames');
    }

    const updateData: Partial<NewPipeline> = {
      name: updatePipelineDto.name,
      description: updatePipelineDto.description,
      enabled: updatePipelineDto.enabled,
      eventName: updatePipelineDto.eventName,
      script: updatePipelineDto.script,
      eventType: updatePipelineDto.eventType,
      deps: updatePipelineDto.deps ? JSON.stringify(updatePipelineDto.deps) : undefined,
    };

    // Remove undefined values
    const cleanedUpdateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateData as Record<string, unknown>)) {
      if (value !== undefined) {
        cleanedUpdateData[key] = value;
      }
    }

    try {
      const results = await this.db
        .update(pipelines)
        .set(cleanedUpdateData as Partial<NewPipeline>)
        .where(eq(pipelines.id, id))
        .returning();
      if (results.length === 0) {
        throw new Error(`Failed to update pipeline with ID ${String(id)}`);
      }
      const result = results[0];

      // Update script file if script changed
      if (updatePipelineDto.script) {
        this.saveOrUpdateScriptToRunnerPath(id, updatePipelineDto.script);
      }

      // Update dependencies if changed
      if (updatePipelineDto.deps) {
        this.addDeps(
          Array.isArray(updatePipelineDto.deps) ? updatePipelineDto.deps : [updatePipelineDto.deps],
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to update pipeline with ID ${String(id)}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id); // Verify pipeline exists

    await this.db.update(pipelines).set({ deleted: true }).where(eq(pipelines.id, id));

    // Remove script file
    this.deleteScriptById(id);
  }

  async triggerById(
    id: number,
    data?: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    const result = await this.runCodeByPipelineId(id, data);
    return {
      success: result.status === 'success',
      message:
        result.status === 'success'
          ? 'Pipeline executed successfully'
          : 'Pipeline execution failed',
    };
  }

  async dispatchEvent(
    eventName: VanblogSystemEvent,
    data?: Record<string, unknown>,
  ): Promise<CodeResult[]> {
    const pipelineList = await this.findByEvent(eventName);
    const results: CodeResult[] = [];

    for (const pipelineItem of pipelineList) {
      const typedPipeline = pipelineItem;
      if (typedPipeline.enabled) {
        try {
          const result = await this.runCodeByPipelineId(typedPipeline.id, data);
          results.push(result);
        } catch (error) {
          this.logger.error(
            `Pipeline ${String(typedPipeline.id)} execution failed:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    return results;
  }

  // Private methods
  private async init(): Promise<void> {
    // Ensure runner directory exists
    if (!existsSync(this.runnerPath)) {
      mkdirSync(this.runnerPath, { recursive: true });
    }

    // Check and install dependencies
    await this.checkAllDeps();
    await this.saveAllScripts();
  }

  private checkEvent(eventName: string): boolean {
    return VanblogSystemEventNames.includes(eventName);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async getNewId(): Promise<number> {
    while (this.idLock) {
      await this.sleep(10);
    }
    this.idLock = true;

    try {
      const { desc } = await import('drizzle-orm');
      const result = await this.db
        .select({ id: pipelines.id })
        .from(pipelines)
        .orderBy(desc(pipelines.id))
        .limit(1);

      const maxId = result.length > 0 ? result[0].id : 0;
      return maxId + 1;
    } finally {
      this.idLock = false;
    }
  }

  private getPathById(id: number): string {
    return join(this.runnerPath, `${String(id)}.js`);
  }

  private async runCodeByPipelineId(
    id: number,
    data?: Record<string, unknown>,
  ): Promise<CodeResult> {
    await this.findOne(id);
    const traceId = Date.now();

    this.logger.log(
      `[${String(traceId)}] Starting pipeline: ${String(id)} ${JSON.stringify(data ?? {}, null, 2)}`,
    );

    return new Promise((resolve, reject) => {
      const subProcess = fork(this.getPathById(id));

      subProcess.send(data ?? {});

      subProcess.on('message', (msg: CodeResult) => {
        if (msg.status === 'error') {
          subProcess.kill('SIGINT');
          this.logger.error(
            `[${String(traceId)}] Pipeline failed: ${String(id)} ${JSON.stringify(msg, null, 2)}`,
          );
          reject(new Error(JSON.stringify(msg)));
        } else {
          this.logger.log(
            `[${String(traceId)}] Pipeline succeeded: ${String(id)} ${JSON.stringify(msg, null, 2)}`,
          );
          resolve(msg);
        }
      });

      subProcess.on('error', (error) => {
        this.logger.error(`[${String(traceId)}] Pipeline process error: ${String(id)}`, error);
        reject(new Error(`Pipeline process error: ${error.message}`));
      });
    });
  }

  private addDeps(deps: string[]): void {
    for (const dep of deps) {
      try {
        const result = spawnSync('npm', ['install', dep], {
          cwd: this.runnerPath,
          stdio: 'pipe',
        });

        if (result.status !== 0) {
          const errorMsg = result.stderr.toString() || 'Unknown error';
          this.logger.error(`Failed to install dependency ${dep}:`, errorMsg);
        } else {
          this.logger.log(`Successfully installed dependency: ${dep}`);
        }
      } catch (error) {
        this.logger.error(
          `Error installing dependency ${dep}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  private deleteScriptById(id: number): void {
    const scriptPath = this.getPathById(id);
    try {
      if (existsSync(scriptPath)) {
        rmSync(scriptPath);
        this.logger.log(`Deleted script file: ${scriptPath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete script file ${scriptPath}:`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private saveOrUpdateScriptToRunnerPath(id: number, script: string): void {
    const scriptPath = this.getPathById(id);

    try {
      writeFileSync(scriptPath, script, 'utf8');
      this.logger.log(`Saved script to: ${scriptPath}`);
    } catch (error) {
      this.logger.error(
        `Failed to save script to ${scriptPath}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  private async checkAllDeps(): Promise<void> {
    this.logger.log('Initializing pipeline code repository, this may take a while');

    const pipelineList = await this.findAll();
    const allDeps: string[] = [];

    for (const pipelineItem of pipelineList) {
      const typedPipeline = pipelineItem;
      if (typedPipeline.deps) {
        const deps = JSON.parse(typedPipeline.deps) as string[];
        for (const dep of deps) {
          if (!allDeps.includes(dep)) {
            allDeps.push(dep);
          }
        }
      }
    }

    if (allDeps.length > 0) {
      this.addDeps(allDeps);
    }
  }

  private async saveAllScripts(): Promise<void> {
    const pipelineList = await this.findAll();

    for (const pipelineItem of pipelineList) {
      const typedPipeline = pipelineItem;
      this.saveOrUpdateScriptToRunnerPath(typedPipeline.id, typedPipeline.script);
    }
  }
}

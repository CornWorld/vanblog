import { client } from '../client';

export const pipelineService = {
  getPipelines: client.getPipelines,
  getPipelineConfig: client.getPipelineConfig,
  getPipeline: client.getPipeline,
  updatePipeline: client.updatePipeline,
  deletePipeline: client.deletePipeline,
  createPipeline: client.createPipeline,
  triggerPipeline: client.triggerPipeline,
};

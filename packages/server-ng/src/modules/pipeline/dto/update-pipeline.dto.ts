import { PartialType } from '@nestjs/swagger';
import { CreatePipelineDto } from './create-pipeline.dto';

export class UpdatePipelineDto extends PartialType(CreatePipelineDto) {}

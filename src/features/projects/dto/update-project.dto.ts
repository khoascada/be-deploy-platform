import { createZodDto } from 'nestjs-zod';
import { updateProjectSchema } from '../schemas/project.schema';

export class UpdateProjectDto extends createZodDto(updateProjectSchema) {}

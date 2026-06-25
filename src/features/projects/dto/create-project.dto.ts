import { createZodDto } from 'nestjs-zod';
import { createProjectSchema } from '../schemas/project.schema';

export class CreateProjectDto extends createZodDto(createProjectSchema) {}

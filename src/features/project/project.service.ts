import { Injectable } from '@nestjs/common';
import { ProjectRepository } from './project.repository';

@Injectable()
export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}
}

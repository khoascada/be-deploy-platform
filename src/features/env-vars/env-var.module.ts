import { Module } from '@nestjs/common';
import { ProjectModule } from '../projects/project.module';
import { EnvVarController } from './env-var.controller';
import { EnvVarRepository } from './env-var.repository';
import { EnvVarService } from './env-var.service';

@Module({
  imports: [ProjectModule],
  controllers: [EnvVarController],
  providers: [EnvVarService, EnvVarRepository],
})
export class EnvVarModule {}

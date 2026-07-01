import { ApiProperty } from '@nestjs/swagger';
import { LogLevel, LogStream } from '@prisma/client';

const LOG_LEVEL_VALUES = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
const LOG_STREAM_VALUES = ['SYSTEM', 'STDOUT', 'STDERR'] as const;

export class DeploymentLogResponseDto {
  @ApiProperty({ example: 'log-123' })
  id!: string;

  @ApiProperty({ example: 'deployment-123' })
  deploymentId!: string;

  @ApiProperty({ example: 'project-123' })
  projectId!: string;

  @ApiProperty({ example: 34 })
  seq!: number;

  @ApiProperty({ example: 'INFO', enum: LOG_LEVEL_VALUES })
  level!: LogLevel;

  @ApiProperty({ example: 'STDERR', enum: LOG_STREAM_VALUES })
  stream!: LogStream;

  @ApiProperty({ example: '#34 DONE 1.6s' })
  message!: string;

  @ApiProperty({ example: '2026-07-01T12:00:00.000Z', type: String })
  createdAt!: string;
}

export function toDeploymentLogResponseDto(
  log: {
    id: string;
    deploymentId: string;
    projectId: string;
    seq: number;
    level: LogLevel;
    stream: LogStream;
    message: string;
    createdAt: Date;
  },
): DeploymentLogResponseDto {
  return {
    id: log.id,
    deploymentId: log.deploymentId,
    projectId: log.projectId,
    seq: log.seq,
    level: log.level,
    stream: log.stream,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
  };
}

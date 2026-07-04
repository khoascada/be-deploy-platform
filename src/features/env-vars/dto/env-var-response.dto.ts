import { ApiProperty } from '@nestjs/swagger';
import type { EnvScope, EnvVar } from '@prisma/client';

const ENV_SCOPE_VALUES = ['RUNTIME', 'BUILD', 'BOTH'] as const;

export class EnvVarResponseDto {
  @ApiProperty({ example: 'env_123' })
  id!: string;

  @ApiProperty({ example: 'project_123' })
  projectId!: string;

  @ApiProperty({ example: 'DATABASE_URL' })
  key!: string;

  @ApiProperty({ enum: ENV_SCOPE_VALUES, example: 'BOTH' })
  scope!: EnvScope;

  @ApiProperty({ example: true })
  isEnabled!: boolean;

  @ApiProperty({ example: true })
  hasValue!: boolean;

  @ApiProperty({ example: '2026-07-04T02:00:00.000Z', type: String })
  createdAt!: Date;

  @ApiProperty({ example: '2026-07-04T02:10:00.000Z', type: String })
  updatedAt!: Date;
}

export function toEnvVarResponseDto(envVar: EnvVar): EnvVarResponseDto {
  return {
    id: envVar.id,
    projectId: envVar.projectId,
    key: envVar.key,
    scope: envVar.scope,
    isEnabled: envVar.isEnabled,
    hasValue: envVar.valueEncrypted.length > 0,
    createdAt: envVar.createdAt,
    updatedAt: envVar.updatedAt,
  };
}

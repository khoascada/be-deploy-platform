import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import type { DeploymentCommandResult } from './deployment.types';

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  onStdoutLine?: (line: string) => void | Promise<void>;
  onStderrLine?: (line: string) => void | Promise<void>;
}

export class DeploymentCommandError extends Error {
  constructor(
    message: string,
    readonly result: DeploymentCommandResult,
  ) {
    super(message);
  }
}

@Injectable()
export class DeploymentCommandRunnerService {
  async run(
    command: string,
    args: string[],
    options: RunCommandOptions = {},
  ): Promise<DeploymentCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let pendingWrites = Promise.resolve();

      const flushLines = (
        buffer: string,
        callback: ((line: string) => void | Promise<void>) | undefined,
      ) => {
        const normalized = buffer.replace(/\r\n/g, '\n');
        const parts = normalized.split('\n');
        const remainder = parts.pop() ?? '';

        for (const line of parts) {
          const trimmedLine = line.trimEnd();
          if (!trimmedLine || !callback) {
            continue;
          }

          pendingWrites = pendingWrites.then(() => callback(trimmedLine));
        }

        return remainder;
      };

      child.stdout.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stdout += text;
        stdoutBuffer += text;
        stdoutBuffer = flushLines(stdoutBuffer, options.onStdoutLine);
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderr += text;
        stderrBuffer += text;
        stderrBuffer = flushLines(stderrBuffer, options.onStderrLine);
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (stdoutBuffer.trim() && options.onStdoutLine) {
          pendingWrites = pendingWrites.then(() =>
            options.onStdoutLine?.(stdoutBuffer.trimEnd()),
          );
        }

        if (stderrBuffer.trim() && options.onStderrLine) {
          pendingWrites = pendingWrites.then(() =>
            options.onStderrLine?.(stderrBuffer.trimEnd()),
          );
        }

        void pendingWrites.then(() => {
          const result: DeploymentCommandResult = {
            stdout,
            stderr,
            exitCode: code,
          };

          if (code === 0) {
            resolve(result);
            return;
          }

          reject(
            new DeploymentCommandError(
              `${command} exited with code ${code ?? 'unknown'}`,
              result,
            ),
          );
        });
      });
    });
  }
}

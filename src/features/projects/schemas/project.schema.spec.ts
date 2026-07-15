import { updateProjectSchema } from './project.schema';

describe('updateProjectSchema', () => {
  it('accepts a partial settings payload', () => {
    expect(updateProjectSchema.parse({ autoDeploy: false })).toEqual({
      autoDeploy: false,
    });
  });

  it('normalizes empty paths and host port', () => {
    expect(
      updateProjectSchema.parse({
        rootDirectory: ' ',
        dockerfilePath: '',
        buildContext: '  ',
        hostPort: null,
      }),
    ).toEqual({
      rootDirectory: '.',
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      hostPort: null,
    });
  });

  it('rejects an empty payload', () => {
    expect(() => updateProjectSchema.parse({})).toThrow();
  });

  it('rejects unknown fields and invalid ports', () => {
    expect(() => updateProjectSchema.parse({ name: 'renamed' })).toThrow();
    expect(() => updateProjectSchema.parse({ containerPort: 0 })).toThrow();
    expect(() => updateProjectSchema.parse({ hostPort: 'invalid' })).toThrow();
  });
});

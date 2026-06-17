const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const outputPath = path.join(process.cwd(), 'prisma', 'ERD.md');
const mermaidPath = path.join(process.cwd(), 'prisma', 'ERD.mmd');

const schema = fs.readFileSync(schemaPath, 'utf8');
const lines = schema.split(/\r?\n/);

const models = [];
let currentModel = null;

for (const rawLine of lines) {
  const line = rawLine.trim();

  if (!currentModel) {
    const modelMatch = line.match(/^model\s+(\w+)\s+\{$/);
    if (modelMatch) {
      currentModel = { name: modelMatch[1], lines: [] };
    }
    continue;
  }

  if (line === '}') {
    models.push(currentModel);
    currentModel = null;
    continue;
  }

  currentModel.lines.push(rawLine);
}

const modelNames = new Set(models.map((model) => model.name));
const scalarTypes = new Set([
  'String',
  'Boolean',
  'Int',
  'BigInt',
  'Float',
  'Decimal',
  'DateTime',
  'Json',
  'Bytes',
]);

function getBaseType(type) {
  return type.replace(/[?\[\]]/g, '');
}

function getArity(type) {
  if (type.endsWith('[]')) return 'many';
  if (type.endsWith('?')) return 'optional';
  return 'required';
}

function parseRelationAttribute(attributes) {
  const relationMatch = attributes.match(/@relation\(([^)]*)\)/);
  if (!relationMatch) return null;

  const content = relationMatch[1];
  const nameMatch = content.match(/"([^"]+)"/);
  const fieldsMatch = content.match(/fields:\s*\[([^\]]*)\]/);
  const referencesMatch = content.match(/references:\s*\[([^\]]*)\]/);

  return {
    name: nameMatch ? nameMatch[1] : null,
    fields: fieldsMatch
      ? fieldsMatch[1]
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean)
      : [],
    references: referencesMatch
      ? referencesMatch[1]
          .split(',')
          .map((field) => field.trim())
          .filter(Boolean)
      : [],
  };
}

function parseField(rawLine) {
  const noComment = rawLine.split('//')[0].trim();
  if (!noComment || noComment.startsWith('@@')) return null;

  const parts = noComment.split(/\s+/);
  if (parts.length < 2) return null;

  const [name, type, ...rest] = parts;
  const attributes = rest.join(' ');
  const baseType = getBaseType(type);

  return {
    name,
    type,
    baseType,
    arity: getArity(type),
    attributes,
    isId: attributes.includes('@id'),
    isRelation: modelNames.has(baseType),
    relation: parseRelationAttribute(attributes),
    isScalar: scalarTypes.has(baseType),
  };
}

const parsedModels = models.map((model) => {
  const fields = model.lines.map(parseField).filter(Boolean);
  const foreignKeys = new Set();

  for (const field of fields) {
    if (field.relation) {
      for (const fkField of field.relation.fields) {
        foreignKeys.add(fkField);
      }
    }
  }

  return {
    name: model.name,
    fields,
    foreignKeys,
  };
});

function relationKey(modelName, field) {
  if (field.relation?.name) {
    return `${field.relation.name}::${[modelName, field.baseType].sort().join('::')}`;
  }

  return `${[modelName, field.baseType].sort().join('::')}`;
}

const relationGroups = new Map();

for (const model of parsedModels) {
  for (const field of model.fields) {
    if (!field.isRelation) continue;

    const key = relationKey(model.name, field);
    const group = relationGroups.get(key) ?? [];
    group.push({ model: model.name, field });
    relationGroups.set(key, group);
  }
}

function toSymbol(arity) {
  if (arity === 'many') return '}o';
  if (arity === 'optional') return '|o';
  return '||';
}

function labelForRelation(entry) {
  return entry.field.relation?.name || entry.field.name;
}

const renderedRelations = [];
const seenPairs = new Set();

for (const entries of relationGroups.values()) {
  if (entries.length === 0) continue;

  const left = entries[0];
  const right =
    entries.find((entry) => entry.model !== left.model || entry.field.name !== left.field.name) ??
    null;

  const leftSideMultiplicity = right ? right.field.arity : 'many';
  const rightSideMultiplicity = left.field.arity;
  const dedupeKey = [left.model, left.field.name, right?.model ?? '', right?.field.name ?? ''].join('::');

  if (seenPairs.has(dedupeKey)) continue;
  seenPairs.add(dedupeKey);

  renderedRelations.push(
    `${left.model} ${toSymbol(leftSideMultiplicity)}--${toSymbol(rightSideMultiplicity)} ${left.field.baseType} : ${labelForRelation(left)}`,
  );
}

function renderField(field, foreignKeys) {
  const tags = [];

  if (field.isId) tags.push('PK');
  if (foreignKeys.has(field.name)) tags.push('FK');

  const tagText = tags.length > 0 ? ` ${tags.join(' ')}` : '';
  const note = field.arity === 'optional' ? ' "nullable"' : '';

  return `\t\t${field.baseType} ${field.name}${tagText}${note}`;
}

const mermaidLines = ['erDiagram'];

for (const model of parsedModels) {
  mermaidLines.push(`\t${model.name} {`);

  for (const field of model.fields) {
    if (!field.isRelation) {
      mermaidLines.push(renderField(field, model.foreignKeys));
    }
  }

  mermaidLines.push('\t}');
}

for (const relation of renderedRelations.sort()) {
  mermaidLines.push(`\t${relation}`);
}

const markdown = `# Prisma ERD

\`\`\`mermaid
${mermaidLines.join('\n')}
\`\`\`
`;

fs.writeFileSync(mermaidPath, `${mermaidLines.join('\n')}\n`, 'utf8');
fs.writeFileSync(outputPath, markdown, 'utf8');
console.log(`ERD written to ${path.relative(process.cwd(), outputPath)}`);

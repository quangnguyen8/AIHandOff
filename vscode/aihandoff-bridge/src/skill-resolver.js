const fs = require('fs');
const path = require('path');

const cache = new Map();

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function loadRegistry(kitRoot) {
  if (!kitRoot) {
    return [];
  }

  const normalizedRoot = path.resolve(kitRoot);
  if (cache.has(normalizedRoot)) {
    return cache.get(normalizedRoot);
  }

  const registryPath = path.join(normalizedRoot, 'skills', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    cache.set(normalizedRoot, []);
    return [];
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const packs = [];

  for (const relativePackDir of registry.packs || []) {
    const packDir = path.join(normalizedRoot, 'skills', relativePackDir);
    const packPath = path.join(packDir, 'pack.json');
    if (!fs.existsSync(packPath)) {
      continue;
    }

    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
    const renderedSections = [];
    for (const fileName of pack.files || []) {
      const sectionPath = path.join(packDir, fileName);
      if (!fs.existsSync(sectionPath)) {
        continue;
      }

      const content = fs.readFileSync(sectionPath, 'utf8').trim();
      if (content) {
        renderedSections.push(content);
      }
    }

    packs.push({
      id: pack.id,
      mode: pack.mode || 'baseline',
      priority: Number(pack.priority || 0),
      appliesTo: pack.appliesTo || {},
      content: renderedSections.join('\n\n')
    });
  }

  cache.set(normalizedRoot, packs);
  return packs;
}

function matchesCriterion(values, actual) {
  if (!values || values.length === 0) {
    return true;
  }

  const normalizedActual = normalizeValue(actual);
  return values.map(normalizeValue).includes(normalizedActual);
}

function matchesPack(pack, context) {
  const appliesTo = pack.appliesTo || {};
  return (
    matchesCriterion(appliesTo.agent, context.agent) &&
    matchesCriterion(appliesTo.profile, context.profile) &&
    matchesCriterion(appliesTo.role, context.role) &&
    matchesCriterion(appliesTo.phase, context.phase)
  );
}

function sortPacks(left, right) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return left.id.localeCompare(right.id);
}

function resolveSkillPacks(options) {
  const skillContext = (options && options.skillContext) || {};
  const packs = loadRegistry(skillContext.kitRoot);
  if (packs.length === 0) {
    return { baseline: [], injected: [], sections: [] };
  }

  const context = {
    agent: options.agent,
    profile: options.profile,
    role: options.role,
    phase: options.phase
  };

  const matching = packs.filter((pack) => matchesPack(pack, context)).sort(sortPacks);
  const baseline = matching.filter((pack) => pack.mode === 'baseline');
  const injected = matching.filter((pack) => pack.mode === 'injected');

  return {
    baseline: baseline.map((pack) => pack.id),
    injected: injected.map((pack) => pack.id),
    sections: matching.map((pack) => pack.content).filter(Boolean)
  };
}

module.exports = {
  resolveSkillPacks
};

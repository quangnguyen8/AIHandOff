function detectStartRoleFromTerminalName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  if (normalized.includes('aihandoff: start plan')) {
    return 'plan';
  }

  if (normalized.includes('aihandoff: start code')) {
    return 'code';
  }

  if (normalized.includes('aihandoff: start review')) {
    return 'review';
  }

  return null;
}

module.exports = {
  detectStartRoleFromTerminalName
};

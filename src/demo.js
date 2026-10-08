import { CONFIG } from './config.js';
export function demoSnapshot(state = 'building', now = Date.now()) {
  const event = (type, minutes, repo, payload = {}) => ({ id: `demo-${minutes}`, type, created_at: new Date(now - minutes * 60000).toISOString(), repo: { name: `${CONFIG.username}/${repo}` }, payload });
  const events = [event('PushEvent', 3, 'little-workshop', { ref: 'refs/heads/main', size: 3 }), event('PullRequestEvent', 12, 'little-workshop', { action: 'opened', pull_request: { title: 'Give the workshop a heartbeat' } }), event('PushEvent', 23, 'little-workshop'), event('CreateEvent', 38, 'little-workshop', { ref_type: 'branch', ref: 'tiny-tools' }), event('ReleaseEvent', 95, 'robot-garage', { action: 'published', release: { tag_name: 'v1.0.0' } })];
  if (state === 'planning') events.unshift(event('CreateEvent', 1, 'little-workshop', { ref_type: 'branch', ref: 'next-big-idea' }));
  if (state === 'shipping') events.unshift(event('ReleaseEvent', 1, 'little-workshop', { action: 'published', release: { tag_name: 'v1.1.0' } }));
  if (state === 'idle') events.forEach(e => { e.created_at = new Date(Date.parse(e.created_at) - 6 * 3600000).toISOString(); });
  return { events, runs: state === 'testing' ? [{ name: 'Workshop checks', status: 'in_progress', repo: `${CONFIG.username}/little-workshop` }] : [], repos: ['little-workshop', 'robot-garage', 'tea-protocol'].map((name, index) => ({ name, full_name: `${CONFIG.username}/${name}`, description: 'An imaginary project for the demo.', language: 'JavaScript', stargazers_count: 0, created_at: new Date(now - (name === 'little-workshop' ? 2 : 30 + index) * 3600000).toISOString() })), checkedAt: new Date(now).toISOString(), workflowWarning: '', repoWarning: '' };
}
export function demoHistory(end = Date.now()) {
  const projects = [
    ['instant-wallet', 'A small wallet for everyday payments.'], ['clawd-harness', 'A little agent harness for the workbench.'],
    ['clawd-txn-simulator', 'A transaction simulator.'], ['wedgie-safe', 'A little safe.'],
    ['wedgie-grove', 'A tiny grove of trees.'], ['wedgie-keypad', 'A keypad.'],
    ['slop-lessons', 'A lesson book.'], ['clawd-research', 'Research tools.'],
    ['workshop-bot', 'A small robot helper.'],
  ];
  const events = projects.flatMap(([name], i) => {
    const base = end - (23 - i * 2.55) * 3600000;
    return ['CreateEvent', 'PushEvent', 'PushEvent', 'ReleaseEvent'].map((type, j) => ({
      id: `day-demo-${i}-${j}`, type, repo: { name: `${CONFIG.username}/${name}` },
      created_at: new Date(base + j * 9 * 60000).toISOString(),
      payload: type === 'ReleaseEvent' ? { action: 'published', release: { tag_name: `v0.${i + 1}.0` } } : type === 'CreateEvent' ? { ref_type: 'branch', ref: 'a-little-progress' } : { ref: 'refs/heads/main', size: 2 },
    }));
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return { events, repos: projects.map(([name, description]) => ({ name, description, full_name: `${CONFIG.username}/${name}`, language: 'JavaScript', stargazers_count: 0 })), end, checkedAt: new Date(end).toISOString(), partial: false, warning: '' };
}

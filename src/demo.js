import { CONFIG } from './config.js';
export function demoSnapshot(state = 'building', now = Date.now()) {
  const event = (type, minutes, repo, payload = {}) => ({ id: `demo-${minutes}`, type, created_at: new Date(now - minutes * 60000).toISOString(), repo: { name: `${CONFIG.username}/${repo}` }, payload });
  const events = [event('PushEvent', 3, 'little-workshop', { ref: 'refs/heads/main', size: 3 }), event('PullRequestEvent', 12, 'little-workshop', { action: 'opened', pull_request: { title: 'Give the workshop a heartbeat' } }), event('PushEvent', 23, 'little-workshop'), event('CreateEvent', 38, 'little-workshop', { ref_type: 'branch', ref: 'tiny-tools' }), event('ReleaseEvent', 95, 'robot-garage', { action: 'published', release: { tag_name: 'v1.0.0' } })];
  if (state === 'planning') events.unshift(event('CreateEvent', 1, 'little-workshop', { ref_type: 'branch', ref: 'next-big-idea' }));
  if (state === 'shipping') events.unshift(event('ReleaseEvent', 1, 'little-workshop', { action: 'published', release: { tag_name: 'v1.1.0' } }));
  if (state === 'idle') events.forEach(e => { e.created_at = new Date(Date.parse(e.created_at) - 6 * 3600000).toISOString(); });
  return { events, runs: state === 'testing' ? [{ name: 'Workshop checks', status: 'in_progress', repo: `${CONFIG.username}/little-workshop` }] : [], repos: ['little-workshop', 'robot-garage', 'tea-protocol'].map(name => ({ name, full_name: `${CONFIG.username}/${name}`, description: 'An imaginary project for the demo.', language: 'JavaScript', stargazers_count: 0 })), checkedAt: new Date(now).toISOString(), workflowWarning: '', repoWarning: '' };
}

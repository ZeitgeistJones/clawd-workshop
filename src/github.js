import { CONFIG } from './config.js';
import { normalizeEvents, freshestSignal } from './activity.js';
import { mergeEvents, DAY_MS } from './replay.js';

export class GithubClient {
  constructor(fetcher = globalThis.fetch.bind(globalThis)) { this.fetcher = fetcher; this.cache = new Map(); this.blockedUntil = 0; this.pollMs = CONFIG.refreshMs; }
  async request(path, ttl = 0) {
    const now = Date.now(), cached = this.cache.get(path);
    if (cached && now - cached.at < ttl) return cached.data;
    if (now < this.blockedUntil) throw new Error(`GitHub rate limit. Try again after ${new Date(this.blockedUntil).toLocaleTimeString()}.`);
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10' };
    if (cached?.etag) headers['If-None-Match'] = cached.etag;
    const response = await this.fetcher(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(15000) });
    const poll = Number(response.headers.get('x-poll-interval'));
    if (poll > 0) this.pollMs = Math.max(CONFIG.refreshMs, poll * 1000);
    if (response.status === 304 && cached) { cached.at = now; return cached.data; }
    if (!response.ok) {
      const exhausted = response.headers.get('x-ratelimit-remaining') === '0';
      if (response.status === 429 || exhausted || (response.status === 403 && response.headers.get('retry-after'))) {
        const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
        const retry = Number(response.headers.get('retry-after')) * 1000;
        this.blockedUntil = Math.max(now + (retry || 60000), reset || 0);
        throw new Error(`GitHub rate limit. Next attempt after ${new Date(this.blockedUntil).toLocaleTimeString()}.`);
      }
      throw new Error(response.status === 404 ? 'GitHub profile or repository was not found.' : `GitHub returned ${response.status}. Please try again later.`);
    }
    const data = await response.json();
    this.cache.set(path, { data, at: now, etag: response.headers.get('etag') });
    return data;
  }
  async snapshot() {
    const user = encodeURIComponent(CONFIG.username);
    const events = normalizeEvents(await this.request(`/users/${user}/events/public?per_page=100`));
    // Repo list is context + a fresher "Updated" signal when the public event feed lags.
    const repoResult = await Promise.allSettled([this.request(`/users/${user}/repos?sort=pushed&per_page=100`)]);
    const repos = repoResult[0].status === 'fulfilled' && Array.isArray(repoResult[0].value) ? repoResult[0].value : [];
    const activeRepo = freshestSignal(events, repos)?.repo;
    let runs = [], workflowWarning = '';
    if (activeRepo) {
      try {
        const data = await this.request(`/repos/${activeRepo}/actions/runs?per_page=20`);
        if (!Array.isArray(data.workflow_runs)) throw new Error('Unexpected workflow response.');
        // Do not attribute another contributor's workflow to Clawd.
        runs = data.workflow_runs.filter(r => [r.actor?.login, r.triggering_actor?.login].some(login => login?.toLowerCase() === CONFIG.username.toLowerCase())).map(r => ({ ...r, repo: activeRepo }));
      } catch (error) { workflowWarning = `Workflow check unavailable: ${error.message}`; }
    }
    return { events, repos, runs, checkedAt: new Date().toISOString(), workflowWarning, repoWarning: repoResult[0].status === 'rejected' ? 'Repository list unavailable.' : '' };
  }
  async history(seed = {}, end = Date.now()) {
    const cutoff = end - DAY_MS, user = encodeURIComponent(CONFIG.username);
    let raw = [], coversWindow = false, warning = '', failed = false;
    for (let page = 1; page <= 3; page++) {
      try {
        const path = `/users/${user}/events/public?per_page=100${page > 1 ? `&page=${page}` : ''}`;
        const data = await this.request(path, CONFIG.refreshMs);
        if (!Array.isArray(data)) throw new Error('Unexpected GitHub event response.');
        raw.push(...data);
        const oldest = Math.min(...data.map(e => Date.parse(e.created_at)).filter(Number.isFinite));
        if (data.length < 100 || oldest <= cutoff) { coversWindow = true; break; }
      } catch (error) { warning = error.message; failed = true; break; }
    }
    const all = mergeEvents(raw, seed.historyEvents || [], seed.events || []);
    const events = all.filter(e => Date.parse(e.created_at) >= cutoff && Date.parse(e.created_at) <= end);
    if (!events.length && failed) throw new Error(warning || 'Replay history could not be loaded.');
    const earliest = Math.min(...raw.map(e => Date.parse(e.created_at)).filter(Number.isFinite), ...events.map(e => Date.parse(e.created_at)));
    return { events, repos: seed.repos || [], end, partial: !coversWindow, coverageStart: coversWindow ? cutoff : (Number.isFinite(earliest) ? Math.max(cutoff, earliest) : end), checkedAt: new Date().toISOString(), warning: warning || (!coversWindow ? 'The public feed reached its 300-event limit before covering the full day.' : '') };
  }
  async details(repo) {
    if (!/^[-\w.]+\/[-\w.]+$/.test(repo || '')) throw new Error('Invalid repository.');
    const results = await Promise.allSettled([
      this.request(`/repos/${repo}`, 600000),
      this.request(`/repos/${repo}/commits?per_page=4`, 600000),
    ]);
    return {
      metadata: results[0].status === 'fulfilled' ? results[0].value : null,
      commits: results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [],
      warning: results.some(r => r.status === 'rejected') ? 'Some repository details could not be refreshed.' : '',
    };
  }
}

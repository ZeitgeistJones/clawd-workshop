const ADDRESS = /^0x[a-f0-9]{40}$/i, HASH = /^0x[a-f0-9]{64}$/i;
const ZERO = '0x0000000000000000000000000000000000000000';
export const TOPICS = Object.freeze({ transfer: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', v3: '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67', v4: '0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f' });
const lower = value => String(value || '').toLowerCase();
const wordAddress = value => `0x${lower(value).slice(2).padStart(64, '0')}`;
const word = (data, index) => BigInt(`0x${data.slice(2 + index * 64, 66 + index * 64)}`);
const signed = value => value >= 1n << 255n ? value - (1n << 256n) : value;
const hex = value => `0x${value.toString(16)}`;
export function tokenAmount(raw, decimals = 18) {
  const scale = 10n ** BigInt(decimals);
  return Number(raw / scale) + Number(raw % scale) / Number(scale);
}
export function selectPair(pairs, config, now = Date.now()) {
  if (!Array.isArray(pairs)) throw new Error('Unexpected price response.');
  const valid = pairs.filter(p => p.chainId === config.chainId && lower(p.baseToken?.address) === lower(config.token) && ADDRESS.test(p.quoteToken?.address || '') && Number(p.priceUsd) > 0 && Number.isFinite(Number(p.priceUsd)) && (!config.pairAddress || lower(p.pairAddress) === lower(config.pairAddress)));
  const pair = valid.sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
  if (!pair) throw new Error('No priced CLAWD pair matched the configured chain and token.');
  return { ...pair, price: Number(pair.priceUsd), at: now };
}
export function swapSpec(pair, config) {
  const pairId = lower(pair?.pairAddress), quote = lower(pair?.quoteToken?.address);
  if (lower(pair?.baseToken?.address) !== lower(config.token) || !ADDRESS.test(quote)) return null;
  if (pair.dexId !== 'uniswap') return null;
  const tokenIndex = lower(config.token) < quote ? 0 : 1;
  if (HASH.test(pairId)) return { version: 'v4', address: lower(config.v4Manager), poolId: pairId, tokenIndex };
  if (ADDRESS.test(pairId) && pair.labels?.some(l => /v3/i.test(l))) return { version: 'v3', address: pairId, tokenIndex };
  return null;
}
export function decodeBurn(log, config) {
  try {
    if (log.removed || lower(log.address) !== lower(config.token) || lower(log.topics?.[0]) !== TOPICS.transfer || log.topics.length !== 3 || !log.topics.slice(1).every(t => HASH.test(t)) || !/^0x[a-f0-9]{64}$/i.test(log.data) || !HASH.test(log.transactionHash)) return null;
    const from = `0x${log.topics[1].slice(-40)}`, to = `0x${log.topics[2].slice(-40)}`;
    if (lower(from) === ZERO || !config.burnAddresses.some(a => lower(a) === lower(to))) return null;
    const amount = tokenAmount(word(log.data, 0), config.decimals);
    if (!Number.isFinite(amount) || amount < config.bigBurnTokens) return null;
    return { id: `${log.transactionHash}:${log.logIndex}`, kind: 'burn', label: lower(to) === ZERO ? 'Token burn' : 'Burn-address transfer', amount, tx: log.transactionHash, block: Number(BigInt(log.blockNumber)) };
  } catch { return null; }
}
export function decodeBuy(log, spec, config, price, now = Date.now()) {
  try {
    if (!spec || log.removed || lower(log.address) !== lower(spec.address) || !HASH.test(log.transactionHash) || lower(log.topics?.[0]) !== TOPICS[spec.version] || !/^0x([a-f0-9]{64}){5,}$/i.test(log.data)) return null;
    if (spec.version === 'v4' && lower(log.topics?.[1]) !== lower(spec.poolId)) return null;
    const a0 = signed(word(log.data, 0)), a1 = signed(word(log.data, 1));
    const raw = spec.tokenIndex === 0 ? a0 : a1, quote = spec.tokenIndex === 0 ? a1 : a0;
    // V4 amounts are caller balance deltas; V3 amounts are pool balance deltas.
    const output = spec.version === 'v4' ? raw > 0n && quote < 0n : raw < 0n && quote > 0n;
    if (!output || !(price?.price > 0) || now - price.at > 90000 || price.at > now) return null;
    const amount = tokenAmount(raw < 0n ? -raw : raw, config.decimals), usd = amount * price.price;
    if (!Number.isFinite(usd) || usd < config.bigBuyUsd) return null;
    return { id: `${log.transactionHash}:${log.logIndex}`, kind: 'buy', label: 'Buy-side swap', amount, usd, tx: log.transactionHash, block: Number(BigInt(log.blockNumber)) };
  } catch { return null; }
}

export class MarketClient {
  constructor(config, fetcher = globalThis.fetch.bind(globalThis)) { this.config = config; this.fetcher = fetcher; this.cursor = null; this.seen = new Set(); this.price = null; this.pairKey = null; this.validatedPool = ''; this.controller = new AbortController(); this.decimalsVerified = false; }
  dispose() { this.controller.abort(); }
  reset() { this.cursor = null; this.seen.clear(); this.price = null; this.pairKey = null; this.validatedPool = ''; }
  async rpc(method, params = []) {
    const res = await this.fetcher(this.config.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(12000)]) });
    if (!res.ok) throw new Error(`Chain feed returned ${res.status}.`);
    const data = await res.json();
    if (data.error || data.result === undefined) throw new Error(data.error?.message || 'Unexpected chain response.');
    return data.result;
  }
  async quote() {
    const { chainId, token } = this.config;
    const res = await this.fetcher(`https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(token)}`, { signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(12000)]) });
    if (!res.ok) throw new Error(`Price feed returned ${res.status}.`);
    this.price = selectPair(await res.json(), this.config);
    return this.price;
  }
  async watch() {
    if (lower(await this.rpc('eth_chainId')) !== lower(this.config.chainHex)) throw new Error('RPC chain does not match the token.');
    if (!this.decimalsVerified) {
      const result = await this.rpc('eth_call', [{ to: this.config.token, data: '0x313ce567' }, 'latest']);
      if (Number(BigInt(result)) !== this.config.decimals) throw new Error('Token decimals do not match the configuration.');
      this.decimalsVerified = true;
    }
    const end = BigInt(await this.rpc('eth_blockNumber')) - BigInt(this.config.confirmations);
    if (end < 0n) return { events: [], note: 'Waiting for confirmed blocks.' };
    const key = lower(this.price?.pairAddress);
    if (this.cursor === null || key !== this.pairKey) { this.cursor = end; this.pairKey = key; return { events: [], note: 'Watching new blocks; earlier activity is not replayed.' }; }
    if (end < this.cursor) { this.cursor = end; return { events: [], note: 'Chain moved backwards; watcher restarted.' }; }
    if (end === this.cursor) return { events: [], note: 'Waiting for new blocks.' };
    let from = this.cursor + 1n, skipped = false;
    if (end - from > 120n) { from = end - 120n; skipped = true; }
    const spec = swapSpec(this.price, this.config);
    // Verify the two currency addresses directly for a V3 pool before trusting it.
    if (spec?.version === 'v3' && this.validatedPool !== spec.address) {
      const [t0, t1] = await Promise.all(['0x0dfe1681', '0xd21220a7'].map(data => this.rpc('eth_call', [{ to: spec.address, data }, 'latest'])));
      const tokens = [lower(`0x${t0.slice(-40)}`), lower(`0x${t1.slice(-40)}`)];
      if (tokens[spec.tokenIndex] !== lower(this.config.token) || !tokens.includes(lower(this.price.quoteToken.address))) throw new Error('Pool currencies could not be verified.');
      this.validatedPool = spec.address;
    }
    const all = [], jobs = [];
    // Small ranges also work with restrictive public RPC providers.
    for (let start = from; start <= end; start += 10n) {
      const range = { fromBlock: hex(start), toBlock: hex(start + 9n > end ? end : start + 9n) };
      jobs.push({ ...range, address: this.config.token, topics: [TOPICS.transfer, null, this.config.burnAddresses.map(wordAddress)] });
      if (spec) jobs.push({ ...range, address: spec.address, topics: spec.version === 'v4' ? [TOPICS.v4, spec.poolId] : [TOPICS.v3] });
    }
    for (const query of jobs) {
      const logs = await this.rpc('eth_getLogs', [query]);
      if (!Array.isArray(logs)) throw new Error('Unexpected transaction log response.');
      all.push(...logs.filter(log => { try { const block = BigInt(log.blockNumber); return block >= BigInt(query.fromBlock) && block <= BigInt(query.toBlock); } catch { return false; } }));
    }
    const decoded = all.map(log => decodeBurn(log, this.config) || decodeBuy(log, spec, this.config, this.price)).filter(Boolean);
    const events = [...new Map(decoded.map(e => [e.id, e])).values()].sort((a, b) => a.block - b.block).filter(e => !this.seen.has(e.id));
    events.forEach(e => this.seen.add(e.id));
    if (this.seen.size > 500) this.seen = new Set([...this.seen].slice(-250));
    this.cursor = end;
    return { events, note: `${skipped ? 'Older blocks skipped after a connection gap. ' : ''}${spec ? 'Watching the selected pool and token burn addresses.' : 'Burn watcher active; this pool format has no buy decoder.'} ${this.config.confirmations}-block delay.` };
  }
}

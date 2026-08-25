// GEONOSIS — the perceptual membrane around PLACE.
//
// This store intentionally has no dependency on World or Place. Seeing is not
// committing. Adapters may fill this store at high frequency without causing a
// Terrarium deed, reindex, branch mutation, or journal entry.

import { makeObservation, makeSignal, makeCondition, conditionAlive } from './model.js';
import { makeSourcePolicy } from './source-policy.js';

export class Geonosis {
  constructor() {
    this.sources = new Map();
    this.observations = new Map();
    this.signals = new Map();
    this.conditions = new Map();
    this.observers = new Set();
  }

  on(fn) { this.observers.add(fn); return () => this.observers.delete(fn); }
  notify(kind, record) { for (const fn of this.observers) fn(kind, record); }

  registerSource(props) {
    const policy = props?.retention ? makeSourcePolicy(props) : props;
    if (!policy?.id) throw new Error('Geonosis source needs an id');
    this.sources.set(policy.id, policy);
    this.notify('source', policy);
    return policy;
  }

  observe(props) {
    const record = props?.provider && Object.isFrozen(props) ? props : makeObservation(props);
    if (!this.sources.has(record.provider)) {
      throw new Error(`Geonosis observation ${record.id} names unregistered source ${record.provider}`);
    }
    this.observations.set(record.id, record);
    this.notify('observation', record);
    return record;
  }

  signal(props) {
    const record = props?.predicate && Object.isFrozen(props) ? props : makeSignal(props);
    for (const id of record.derivedFrom) {
      if (!this.observations.has(id) && !this.signals.has(id)) {
        throw new Error(`Geonosis signal ${record.id} cites missing evidence ${id}`);
      }
    }
    this.signals.set(record.id, record);
    this.notify('signal', record);
    return record;
  }

  condition(props) {
    const record = props?.state && Object.isFrozen(props) ? props : makeCondition(props);
    for (const id of record.supportedBy) {
      if (!this.signals.has(id) && !this.observations.has(id)) {
        throw new Error(`Geonosis condition ${record.id} cites missing support ${id}`);
      }
    }
    this.conditions.set(record.id, record);
    this.notify('condition', record);
    return record;
  }

  expire(now = Date.now()) {
    const expired = [];
    for (const [id, condition] of this.conditions) {
      if (!conditionAlive(condition, now)) {
        this.conditions.delete(id);
        expired.push(condition);
        this.notify('expired', condition);
      }
    }
    return expired;
  }

  bySubject(subject) {
    return {
      observations: [...this.observations.values()].filter((x) => x.providerRecordId === subject || x.rawProperties?.subject === subject),
      signals: [...this.signals.values()].filter((x) => x.subject === subject),
      conditions: [...this.conditions.values()].filter((x) => x.subject === subject),
    };
  }

  /** Address queries work before Terrarium owns an ICOSA implementation. */
  byAddress(address, { descendants = false } = {}) {
    const match = (record) => (record.address || []).some((a) => descendants ? a === address || a.startsWith(`${address}.`) : a === address);
    return {
      observations: [...this.observations.values()].filter(match),
      signals: [...this.signals.values()].filter(match),
      conditions: [...this.conditions.values()].filter(match),
    };
  }

  snapshot() {
    return JSON.stringify({
      version: 1,
      sources: [...this.sources.values()],
      observations: [...this.observations.values()],
      signals: [...this.signals.values()],
      conditions: [...this.conditions.values()],
    });
  }

  static load(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    if (!data || data.version !== 1) throw new Error('unsupported Geonosis snapshot');
    const g = new Geonosis();
    for (const source of data.sources || []) g.registerSource(source);
    for (const observation of data.observations || []) g.observe(makeObservation(observation));
    for (const signal of data.signals || []) g.signal(makeSignal(signal));
    for (const condition of data.conditions || []) g.condition(makeCondition(condition));
    return g;
  }
}

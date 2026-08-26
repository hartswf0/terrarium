// GEONOSIS — the perceptual membrane around PLACE.
//
// This store intentionally has no dependency on World or Place. Seeing is not
// committing. Adapters may fill this store at high frequency without causing a
// Terrarium deed, reindex, branch mutation, or journal entry.

import {
  makeObservation, makeSignal, makeCondition, makeInterpretant,
  conditionAlive, interpretantAlive,
} from './model.js';
import { makeRelation } from './relation.js';
import { makeSourcePolicy, retentionDecision } from './source-policy.js';

/**
 * ICOSA ancestry is refinement inside a face, not filesystem segmentation.
 * F08.03 contains F08.0312 because both share face F08 and 0312 refines 03.
 * Unknown address syntaxes fall back to exact equality rather than guessing.
 */
export function addressContains(ancestor, candidate) {
  const parse = (value) => {
    const m = /^(F\d{2})(?:\.([A-Za-z0-9]+))?$/.exec(String(value || ''));
    return m ? { face: m[1], path: m[2] || '' } : null;
  };
  const a = parse(ancestor), c = parse(candidate);
  if (!a || !c) return String(ancestor) === String(candidate);
  return a.face === c.face && c.path.startsWith(a.path);
}

export class Geonosis {
  constructor() {
    this.sources = new Map();
    this.observations = new Map();
    this.signals = new Map();
    this.conditions = new Map();
    this.relations = new Map();
    this.interpretants = new Map();
    this.observers = new Set();
  }

  on(fn) { this.observers.add(fn); return () => this.observers.delete(fn); }
  notify(kind, record) { for (const fn of this.observers) fn(kind, record); }

  registerSource(props) {
    const policy = makeSourcePolicy(props);
    this.sources.set(policy.id, policy);
    this.notify('source', policy);
    return policy;
  }

  observe(props) {
    const record = makeObservation(props);
    if (!this.sources.has(record.provider)) {
      throw new Error(`Geonosis observation ${record.id} names unregistered source ${record.provider}`);
    }
    this.observations.set(record.id, record);
    this.notify('observation', record);
    return record;
  }

  signal(props) {
    const record = makeSignal(props);
    for (const id of record.derivedFrom) {
      const observation = this.observations.get(id);
      if (observation) {
        const source = this.sources.get(observation.provider);
        if (source && !source.mayDerive) {
          throw new Error(`Geonosis source ${source.id} forbids derived signals`);
        }
        continue;
      }
      if (!this.signals.has(id)) throw new Error(`Geonosis signal ${record.id} cites missing evidence ${id}`);
    }
    this.signals.set(record.id, record);
    this.notify('signal', record);
    return record;
  }

  condition(props) {
    const record = makeCondition(props);
    for (const id of record.supportedBy) {
      if (!this.signals.has(id) && !this.observations.has(id)) {
        throw new Error(`Geonosis condition ${record.id} cites missing support ${id}`);
      }
    }
    this.conditions.set(record.id, record);
    this.notify('condition', record);
    return record;
  }

  relate(props) {
    const record = makeRelation(props);
    for (const id of record.derivedFrom) {
      if (!this.observations.has(id) && !this.signals.has(id)
          && !this.conditions.has(id) && !this.relations.has(id)) {
        throw new Error(`Geonosis relation ${record.id} cites missing evidence ${id}`);
      }
    }
    this.relations.set(record.id, record);
    this.notify('relation', record);
    return record;
  }

  interpret(props) {
    const record = makeInterpretant(props);
    for (const id of record.derivedFrom) {
      if (!this.conditions.has(id) && !this.signals.has(id)
          && !this.observations.has(id) && !this.relations.has(id)) {
        throw new Error(`Geonosis interpretant ${record.id} cites missing evidence ${id}`);
      }
    }
    this.interpretants.set(record.id, record);
    this.notify('interpretant', record);
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
    for (const [id, interpretant] of this.interpretants) {
      if (!interpretantAlive(interpretant, now)) {
        this.interpretants.delete(id);
        expired.push(interpretant);
        this.notify('expired', interpretant);
      }
    }
    return expired;
  }

  bySubject(subject) {
    return {
      observations: [...this.observations.values()].filter((x) => x.providerRecordId === subject || x.rawProperties?.subject === subject),
      signals: [...this.signals.values()].filter((x) => x.subject === subject),
      conditions: [...this.conditions.values()].filter((x) => x.subject === subject),
      relations: [...this.relations.values()].filter((x) => x.from === subject || x.to === subject),
      interpretants: [...this.interpretants.values()].filter((x) => x.subject === subject),
    };
  }

  byActor(actor) {
    return [...this.interpretants.values()].filter((x) => x.actor === actor);
  }

  /** Address queries work before Terrarium owns an ICOSA implementation. */
  byAddress(address, { descendants = false } = {}) {
    const match = (record) => (record.address || []).some((a) => descendants ? addressContains(address, a) : a === address);
    return {
      observations: [...this.observations.values()].filter(match),
      signals: [...this.signals.values()].filter(match),
      conditions: [...this.conditions.values()].filter(match),
      relations: [...this.relations.values()].filter(match),
      interpretants: [...this.interpretants.values()].filter(match),
    };
  }

  /**
   * Durable snapshots obey each source's retention law.
   * MIRROR keeps the complete observation; SNAPSHOT keeps normalized geometry
   * but strips provider-specific raw properties; EPHEMERAL and REFERENCE keep
   * only a citation stub so derived claims can remain auditable without quietly
   * caching the source payload.
   */
  snapshot() {
    const observations = [...this.observations.values()].map((record) => {
      const policy = this.sources.get(record.provider);
      const decision = retentionDecision(policy);
      if (decision.persistRaw) return { ...record, payloadState: 'FULL' };
      if (decision.persistNormalized) {
        return { ...record, rawProperties: {}, payloadState: 'NORMALIZED' };
      }
      return {
        id: record.id,
        provider: record.provider,
        providerRecordId: record.providerRecordId,
        geometry: null,
        observedAt: record.observedAt,
        retrievedAt: record.retrievedAt,
        rawProperties: {},
        sourceUrl: record.sourceUrl,
        license: record.license,
        method: record.method,
        resolution: null,
        freshness: 'REFERENCE',
        epistemic: record.epistemic,
        payloadState: 'REFERENCE',
        address: [],
      };
    });

    return JSON.stringify({
      version: 1,
      sources: [...this.sources.values()],
      observations,
      signals: [...this.signals.values()],
      conditions: [...this.conditions.values()],
      relations: [...this.relations.values()],
      interpretants: [...this.interpretants.values()],
    });
  }

  static load(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    if (!data || data.version !== 1) throw new Error('unsupported Geonosis snapshot');
    const g = new Geonosis();
    for (const source of data.sources || []) g.registerSource(source);
    for (const observation of data.observations || []) g.observe(observation);
    for (const signal of data.signals || []) g.signal(signal);
    for (const condition of data.conditions || []) g.condition(condition);
    for (const relation of data.relations || []) g.relate(relation);
    for (const interpretant of data.interpretants || []) g.interpret(interpretant);
    return g;
  }
}

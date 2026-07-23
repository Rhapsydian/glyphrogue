import {
  wandersRule,
  chasesPlayerRule,
  fleesRule,
  guardsRule,
  WANDERS_PRIORITY,
  CHASES_PLAYER_PRIORITY,
  FLEES_PRIORITY,
  GUARDS_PRIORITY,
} from './behaviors.js';
import { CORE_API_VERSION } from './plugins.js';

// Content plugins (scripting-api.md: first-party AI behaviors use the same
// Plugin module format as any end-user plugin) wrapping each of the four
// built-in TakeTurn rules. Ships from @glyphrogue/core itself, not a
// src/plugins/ folder. Each rule's applicability is expressed entirely via
// registerRule's `components` filter (editor.md: "a Wanders rule is
// effectively { all: ['Wanders'] }") rather than a hand-rolled guard inside
// the rule body - behaviors.js's rule functions assume the marker component
// is already present by the time they're called.

export const wandersPlugin = {
  id: 'wanders',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerRule('wanders', 'TakeTurn', wandersRule, {
      priority: WANDERS_PRIORITY,
      components: { all: ['Wanders'] },
    });
  },
};

export const chasesPlayerPlugin = {
  id: 'chases-player',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerRule('chases-player', 'TakeTurn', chasesPlayerRule, {
      priority: CHASES_PLAYER_PRIORITY,
      components: { all: ['ChasesPlayer'] },
    });
  },
};

export const fleesPlugin = {
  id: 'flees',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerRule('flees', 'TakeTurn', fleesRule, {
      priority: FLEES_PRIORITY,
      components: { all: ['Flees'] },
    });
  },
};

export const guardsPlugin = {
  id: 'guards',
  version: '1.0.0',
  dependencies: { core: `^${CORE_API_VERSION}` },
  register: (api) => {
    api.registerRule('guards', 'TakeTurn', guardsRule, {
      priority: GUARDS_PRIORITY,
      components: { all: ['Guards'] },
    });
  },
};

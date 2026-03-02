const PREFIXES = [
  'Swift', 'Dark', 'Iron', 'Storm', 'Bold', 'Grim', 'Dusk', 'Fire', 'Frost', 'Steel',
  'Shadow', 'Bright', 'Thunder', 'Wild', 'Stone', 'Silver', 'Crimson', 'Dire', 'Azure', 'Brave',
  'Ash', 'Ember', 'Moon', 'Star', 'Raven', 'Thorn', 'Wrath', 'Venom', 'Ghost', 'Noble',
];

const SUFFIXES = [
  'Blade', 'Fang', 'Wolf', 'Arrow', 'Shield', 'Hawk', 'Stone', 'Forge', 'Claw', 'Heart',
  'Bane', 'Wing', 'Fury', 'Mark', 'Horn', 'Scar', 'Helm', 'Striker', 'Rider', 'Walker',
  'Fall', 'Guard', 'Breaker', 'Slayer', 'Born', 'Song', 'Mane', 'Root', 'Spark', 'Keep',
];

export function generateName(): string {
  const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
  const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
  const name = prefix + suffix;
  // Ensure ≤16 chars (all combos should fit, but guard)
  return name.slice(0, 16);
}

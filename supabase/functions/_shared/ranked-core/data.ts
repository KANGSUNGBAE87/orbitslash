// Generated from src/data ranked rules by scripts/generate-ranked-edge-core.mjs. Do not edit manually.
export const RANKED_CORE_RULES = {
  enemies: {
  "shard_meteor": {
    "startRadius": 900,
    "approachSpeed": 82,
    "angularSpeed": 0.68,
    "radiusPx": 64,
    "hp": 1,
    "damage": 2,
    "score": 35,
    "directional": false
  },
  "small_meteor": {
    "startRadius": 900,
    "approachSpeed": 72,
    "angularSpeed": 0.6,
    "radiusPx": 86,
    "hp": 3,
    "damage": 3,
    "score": 60,
    "directional": false
  },
  "basic_meteor": {
    "startRadius": 920,
    "approachSpeed": 62,
    "angularSpeed": 0.5,
    "radiusPx": 113,
    "hp": 5,
    "damage": 5,
    "score": 110,
    "directional": false
  },
  "fast_comet": {
    "startRadius": 950,
    "approachSpeed": 96,
    "angularSpeed": 0.7,
    "radiusPx": 99,
    "hp": 7,
    "damage": 8,
    "score": 145,
    "directional": false
  },
  "iron_planet": {
    "startRadius": 920,
    "approachSpeed": 52,
    "angularSpeed": 0.42,
    "radiusPx": 132,
    "hp": 9,
    "damage": 9,
    "score": 175,
    "directional": false
  },
  "directional_comet": {
    "startRadius": 960,
    "approachSpeed": 92,
    "angularSpeed": 0.78,
    "radiusPx": 102,
    "hp": 11,
    "damage": 8,
    "score": 210,
    "directional": true,
    "directionalToleranceDeg": 30
  },
  "heavy_asteroid": {
    "startRadius": 880,
    "approachSpeed": 42,
    "angularSpeed": 0.35,
    "radiusPx": 192,
    "hp": 13,
    "damage": 12,
    "score": 240,
    "directional": false
  },
  "ancient_planet": {
    "startRadius": 900,
    "approachSpeed": 34,
    "angularSpeed": 0.28,
    "radiusPx": 220,
    "hp": 15,
    "damage": 16,
    "score": 300,
    "directional": false
  },
  "fire_meteor": {
    "startRadius": 940,
    "approachSpeed": 74,
    "angularSpeed": 0.58,
    "radiusPx": 126,
    "hp": 7,
    "damage": 15,
    "score": 260,
    "directional": false,
    "attribute": "fire",
    "behavior": "burn"
  },
  "ice_comet": {
    "startRadius": 960,
    "approachSpeed": 86,
    "angularSpeed": 0.66,
    "radiusPx": 118,
    "hp": 7,
    "damage": 7,
    "score": 240,
    "directional": false,
    "attribute": "ice",
    "behavior": "split",
    "splitInto": "shard_meteor",
    "splitCount": 3
  },
  "crystal_meteor": {
    "startRadius": 930,
    "approachSpeed": 68,
    "angularSpeed": 0.54,
    "radiusPx": 124,
    "hp": 9,
    "damage": 9,
    "score": 285,
    "directional": false,
    "attribute": "crystal",
    "behavior": "precision_bonus",
    "precisionBonus": true
  },
  "shield_rock": {
    "startRadius": 910,
    "approachSpeed": 46,
    "angularSpeed": 0.38,
    "radiusPx": 168,
    "hp": 11,
    "damage": 13,
    "score": 330,
    "directional": false,
    "attribute": "metal",
    "behavior": "shield",
    "shieldHits": 2
  },
  "electric_meteor": {
    "startRadius": 950,
    "approachSpeed": 88,
    "angularSpeed": 0.72,
    "radiusPx": 122,
    "hp": 9,
    "damage": 12,
    "score": 310,
    "directional": true,
    "directionalToleranceDeg": 28,
    "attribute": "electric",
    "behavior": "emp",
    "empOnWrongHit": true
  },
  "graviton_core": {
    "startRadius": 980,
    "approachSpeed": 44,
    "angularSpeed": 0.5,
    "radiusPx": 174,
    "hp": 13,
    "damage": 14,
    "score": 420,
    "directional": false,
    "attribute": "gravity",
    "behavior": "orbit_pull",
    "gravityPullRadiusPx": 260
  },
  "dark_meteor": {
    "startRadius": 930,
    "approachSpeed": 78,
    "angularSpeed": 0.64,
    "radiusPx": 138,
    "hp": 11,
    "damage": 14,
    "score": 390,
    "directional": false,
    "attribute": "dark",
    "behavior": "hidden",
    "visibility": "dangerOnly"
  },
  "armored_fragment": {
    "startRadius": 900,
    "approachSpeed": 38,
    "angularSpeed": 0.32,
    "radiusPx": 210,
    "hp": 15,
    "damage": 18,
    "score": 460,
    "directional": false,
    "attribute": "armored",
    "behavior": "armor",
    "armorHits": 2
  },
  "eclipse_core": {
    "startRadius": 980,
    "approachSpeed": 24,
    "angularSpeed": 0.18,
    "radiusPx": 340,
    "hp": 50,
    "damage": 20,
    "score": 1600,
    "directional": false,
    "boss": true,
    "ignoreSpeedScale": true
  },
  "ringed_destroyer": {
    "startRadius": 1020,
    "approachSpeed": 22,
    "angularSpeed": 0.16,
    "radiusPx": 365,
    "hp": 58,
    "damage": 22,
    "score": 1900,
    "directional": false,
    "boss": true,
    "ignoreSpeedScale": true
  },
  "lava_titan": {
    "startRadius": 1040,
    "approachSpeed": 21,
    "angularSpeed": 0.15,
    "radiusPx": 382,
    "hp": 66,
    "damage": 24,
    "score": 2200,
    "directional": false,
    "boss": true,
    "ignoreSpeedScale": true
  },
  "ice_colossus": {
    "startRadius": 1040,
    "approachSpeed": 20,
    "angularSpeed": 0.14,
    "radiusPx": 392,
    "hp": 72,
    "damage": 24,
    "score": 2500,
    "directional": false,
    "boss": true,
    "ignoreSpeedScale": true
  },
  "dark_planet": {
    "startRadius": 1060,
    "approachSpeed": 19,
    "angularSpeed": 0.12,
    "radiusPx": 420,
    "hp": 84,
    "damage": 28,
    "score": 3200,
    "directional": false,
    "boss": true,
    "ignoreSpeedScale": true
  }
},
  difficulty: {
  "rookie": {
    "earthEnergy": 100,
    "gravitySwell": 1,
    "approachSpeedMul": 1
  },
  "defender": {
    "earthEnergy": 90,
    "gravitySwell": 1.08,
    "approachSpeedMul": 1.2
  },
  "elite": {
    "earthEnergy": 75,
    "gravitySwell": 1.16,
    "approachSpeedMul": 1.45
  },
  "master": {
    "earthEnergy": 60,
    "gravitySwell": 1.25,
    "approachSpeedMul": 1.75
  },
  "zones": {
    "outer": 4,
    "mid": 3,
    "danger": 2,
    "lastSave": 1.3,
    "impact": 1.2
  }
},
  orbits: ({
  "profiles": [
    {
      "angularMul": 0.5,
      "dir": 1
    },
    {
      "angularMul": 0.8,
      "dir": 1
    },
    {
      "angularMul": 1.1,
      "dir": 1
    },
    {
      "angularMul": 1.5,
      "dir": 1
    },
    {
      "angularMul": 2,
      "dir": 1
    },
    {
      "angularMul": 0.5,
      "dir": -1
    },
    {
      "angularMul": 0.8,
      "dir": -1
    },
    {
      "angularMul": 1.1,
      "dir": -1
    },
    {
      "angularMul": 1.5,
      "dir": -1
    },
    {
      "angularMul": 2,
      "dir": -1
    }
  ]
}).profiles,
  waves: {
  "rookie": [
    {
      "fromMs": 0,
      "spawnIntervalMs": 940,
      "approachSpeedMul": 1,
      "weights": {
        "shard_meteor": 58,
        "small_meteor": 32,
        "basic_meteor": 10
      }
    },
    {
      "fromMs": 7000,
      "spawnIntervalMs": 900,
      "approachSpeedMul": 1.05,
      "weights": {
        "shard_meteor": 42,
        "small_meteor": 38,
        "basic_meteor": 16,
        "fast_comet": 4
      }
    },
    {
      "fromMs": 14000,
      "spawnIntervalMs": 860,
      "approachSpeedMul": 1.1,
      "weights": {
        "shard_meteor": 30,
        "small_meteor": 36,
        "basic_meteor": 22,
        "fast_comet": 8,
        "iron_planet": 4
      }
    },
    {
      "fromMs": 21000,
      "spawnIntervalMs": 820,
      "approachSpeedMul": 1.16,
      "weights": {
        "shard_meteor": 22,
        "small_meteor": 30,
        "basic_meteor": 25,
        "fast_comet": 12,
        "iron_planet": 7,
        "directional_comet": 4
      },
      "maxConsecutive": {
        "directional_comet": 2
      }
    },
    {
      "fromMs": 28000,
      "spawnIntervalMs": 780,
      "approachSpeedMul": 1.22,
      "weights": {
        "shard_meteor": 16,
        "small_meteor": 22,
        "basic_meteor": 24,
        "fast_comet": 13,
        "iron_planet": 9,
        "fire_meteor": 5,
        "ice_comet": 5,
        "directional_comet": 4,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 35000,
      "spawnIntervalMs": 740,
      "approachSpeedMul": 1.3,
      "weights": {
        "shard_meteor": 12,
        "small_meteor": 18,
        "basic_meteor": 22,
        "fast_comet": 14,
        "iron_planet": 10,
        "fire_meteor": 7,
        "ice_comet": 6,
        "crystal_meteor": 4,
        "directional_comet": 5,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 42000,
      "spawnIntervalMs": 700,
      "approachSpeedMul": 1.38,
      "weights": {
        "shard_meteor": 10,
        "small_meteor": 15,
        "basic_meteor": 20,
        "fast_comet": 16,
        "iron_planet": 12,
        "fire_meteor": 8,
        "ice_comet": 7,
        "crystal_meteor": 5,
        "directional_comet": 5,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 49000,
      "spawnIntervalMs": 670,
      "approachSpeedMul": 1.46,
      "weights": {
        "shard_meteor": 8,
        "small_meteor": 13,
        "basic_meteor": 18,
        "fast_comet": 18,
        "iron_planet": 13,
        "fire_meteor": 9,
        "ice_comet": 8,
        "crystal_meteor": 6,
        "directional_comet": 5,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 56000,
      "spawnIntervalMs": 640,
      "approachSpeedMul": 1.55,
      "weights": {
        "shard_meteor": 6,
        "small_meteor": 11,
        "basic_meteor": 16,
        "fast_comet": 20,
        "iron_planet": 14,
        "fire_meteor": 10,
        "ice_comet": 9,
        "crystal_meteor": 7,
        "directional_comet": 5,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 63000,
      "spawnIntervalMs": 610,
      "approachSpeedMul": 1.65,
      "weights": {
        "shard_meteor": 5,
        "small_meteor": 9,
        "basic_meteor": 14,
        "fast_comet": 21,
        "iron_planet": 15,
        "fire_meteor": 11,
        "ice_comet": 10,
        "crystal_meteor": 8,
        "directional_comet": 5,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    }
  ],
  "defender": [
    {
      "fromMs": 0,
      "spawnIntervalMs": 860,
      "approachSpeedMul": 1.08,
      "weights": {
        "shard_meteor": 34,
        "small_meteor": 34,
        "basic_meteor": 24,
        "fast_comet": 8
      }
    },
    {
      "fromMs": 7000,
      "spawnIntervalMs": 820,
      "approachSpeedMul": 1.14,
      "weights": {
        "shard_meteor": 24,
        "small_meteor": 32,
        "basic_meteor": 28,
        "fast_comet": 12,
        "iron_planet": 4
      }
    },
    {
      "fromMs": 14000,
      "spawnIntervalMs": 780,
      "approachSpeedMul": 1.2,
      "weights": {
        "shard_meteor": 18,
        "small_meteor": 26,
        "basic_meteor": 30,
        "fast_comet": 14,
        "iron_planet": 7,
        "fire_meteor": 5
      }
    },
    {
      "fromMs": 21000,
      "spawnIntervalMs": 740,
      "approachSpeedMul": 1.28,
      "weights": {
        "shard_meteor": 14,
        "small_meteor": 22,
        "basic_meteor": 26,
        "fast_comet": 16,
        "iron_planet": 9,
        "fire_meteor": 6,
        "ice_comet": 5,
        "directional_comet": 2
      },
      "maxConsecutive": {
        "directional_comet": 2
      }
    },
    {
      "fromMs": 28000,
      "spawnIntervalMs": 700,
      "approachSpeedMul": 1.36,
      "weights": {
        "shard_meteor": 10,
        "small_meteor": 18,
        "basic_meteor": 24,
        "fast_comet": 17,
        "iron_planet": 10,
        "fire_meteor": 7,
        "ice_comet": 6,
        "crystal_meteor": 4,
        "directional_comet": 3,
        "heavy_asteroid": 1
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 35000,
      "spawnIntervalMs": 660,
      "approachSpeedMul": 1.45,
      "weights": {
        "small_meteor": 16,
        "basic_meteor": 22,
        "fast_comet": 18,
        "iron_planet": 11,
        "fire_meteor": 9,
        "ice_comet": 8,
        "crystal_meteor": 5,
        "directional_comet": 4,
        "heavy_asteroid": 2
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 42000,
      "spawnIntervalMs": 630,
      "approachSpeedMul": 1.55,
      "weights": {
        "small_meteor": 13,
        "basic_meteor": 20,
        "fast_comet": 19,
        "iron_planet": 12,
        "fire_meteor": 10,
        "ice_comet": 9,
        "crystal_meteor": 6,
        "directional_comet": 5,
        "heavy_asteroid": 3
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 49000,
      "spawnIntervalMs": 600,
      "approachSpeedMul": 1.66,
      "weights": {
        "small_meteor": 10,
        "basic_meteor": 18,
        "fast_comet": 20,
        "iron_planet": 13,
        "fire_meteor": 11,
        "ice_comet": 10,
        "crystal_meteor": 7,
        "directional_comet": 6,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 56000,
      "spawnIntervalMs": 570,
      "approachSpeedMul": 1.78,
      "weights": {
        "small_meteor": 8,
        "basic_meteor": 16,
        "fast_comet": 21,
        "iron_planet": 14,
        "fire_meteor": 12,
        "ice_comet": 11,
        "crystal_meteor": 8,
        "directional_comet": 6,
        "heavy_asteroid": 5
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 63000,
      "spawnIntervalMs": 540,
      "approachSpeedMul": 1.9,
      "weights": {
        "small_meteor": 6,
        "basic_meteor": 14,
        "fast_comet": 22,
        "iron_planet": 15,
        "fire_meteor": 13,
        "ice_comet": 12,
        "crystal_meteor": 9,
        "directional_comet": 7,
        "heavy_asteroid": 6
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "heavy_asteroid": 2
      }
    }
  ],
  "elite": [
    {
      "fromMs": 0,
      "spawnIntervalMs": 760,
      "approachSpeedMul": 1.18,
      "weights": {
        "small_meteor": 28,
        "basic_meteor": 32,
        "fast_comet": 22,
        "iron_planet": 10,
        "fire_meteor": 8
      }
    },
    {
      "fromMs": 7000,
      "spawnIntervalMs": 720,
      "approachSpeedMul": 1.26,
      "weights": {
        "small_meteor": 20,
        "basic_meteor": 30,
        "fast_comet": 24,
        "iron_planet": 12,
        "fire_meteor": 8,
        "ice_comet": 6
      }
    },
    {
      "fromMs": 14000,
      "spawnIntervalMs": 680,
      "approachSpeedMul": 1.36,
      "weights": {
        "small_meteor": 14,
        "basic_meteor": 24,
        "fast_comet": 25,
        "iron_planet": 13,
        "fire_meteor": 9,
        "ice_comet": 7,
        "crystal_meteor": 5,
        "directional_comet": 3
      },
      "maxConsecutive": {
        "directional_comet": 2
      }
    },
    {
      "fromMs": 21000,
      "spawnIntervalMs": 640,
      "approachSpeedMul": 1.48,
      "weights": {
        "basic_meteor": 20,
        "fast_comet": 25,
        "iron_planet": 13,
        "fire_meteor": 10,
        "ice_comet": 8,
        "crystal_meteor": 6,
        "directional_comet": 5,
        "shield_rock": 4,
        "heavy_asteroid": 3
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 28000,
      "spawnIntervalMs": 600,
      "approachSpeedMul": 1.6,
      "weights": {
        "basic_meteor": 16,
        "fast_comet": 24,
        "iron_planet": 13,
        "fire_meteor": 10,
        "ice_comet": 9,
        "crystal_meteor": 7,
        "directional_comet": 6,
        "shield_rock": 5,
        "electric_meteor": 4,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 35000,
      "spawnIntervalMs": 565,
      "approachSpeedMul": 1.72,
      "weights": {
        "basic_meteor": 12,
        "fast_comet": 24,
        "iron_planet": 14,
        "fire_meteor": 11,
        "ice_comet": 10,
        "crystal_meteor": 8,
        "directional_comet": 7,
        "shield_rock": 6,
        "electric_meteor": 5,
        "graviton_core": 3,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 42000,
      "spawnIntervalMs": 535,
      "approachSpeedMul": 1.84,
      "weights": {
        "basic_meteor": 10,
        "fast_comet": 23,
        "iron_planet": 14,
        "fire_meteor": 11,
        "ice_comet": 10,
        "crystal_meteor": 8,
        "directional_comet": 8,
        "shield_rock": 7,
        "electric_meteor": 6,
        "graviton_core": 4,
        "heavy_asteroid": 5
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 49000,
      "spawnIntervalMs": 505,
      "approachSpeedMul": 1.98,
      "weights": {
        "basic_meteor": 8,
        "fast_comet": 22,
        "iron_planet": 14,
        "fire_meteor": 12,
        "ice_comet": 11,
        "crystal_meteor": 9,
        "directional_comet": 8,
        "shield_rock": 8,
        "electric_meteor": 7,
        "graviton_core": 5,
        "heavy_asteroid": 6
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 56000,
      "spawnIntervalMs": 480,
      "approachSpeedMul": 2.1,
      "weights": {
        "basic_meteor": 6,
        "fast_comet": 21,
        "iron_planet": 14,
        "fire_meteor": 12,
        "ice_comet": 12,
        "crystal_meteor": 10,
        "directional_comet": 9,
        "shield_rock": 9,
        "electric_meteor": 8,
        "graviton_core": 6,
        "heavy_asteroid": 7
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 63000,
      "spawnIntervalMs": 455,
      "approachSpeedMul": 2.22,
      "weights": {
        "basic_meteor": 4,
        "fast_comet": 20,
        "iron_planet": 14,
        "fire_meteor": 13,
        "ice_comet": 12,
        "crystal_meteor": 10,
        "directional_comet": 10,
        "shield_rock": 10,
        "electric_meteor": 9,
        "graviton_core": 7,
        "heavy_asteroid": 8
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    }
  ],
  "master": [
    {
      "fromMs": 0,
      "spawnIntervalMs": 650,
      "approachSpeedMul": 1.36,
      "weights": {
        "basic_meteor": 24,
        "fast_comet": 30,
        "iron_planet": 16,
        "fire_meteor": 12,
        "ice_comet": 10,
        "directional_comet": 8
      },
      "maxConsecutive": {
        "directional_comet": 2
      }
    },
    {
      "fromMs": 7000,
      "spawnIntervalMs": 610,
      "approachSpeedMul": 1.5,
      "weights": {
        "basic_meteor": 18,
        "fast_comet": 30,
        "iron_planet": 16,
        "fire_meteor": 13,
        "ice_comet": 11,
        "crystal_meteor": 8,
        "directional_comet": 8,
        "shield_rock": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2
      }
    },
    {
      "fromMs": 14000,
      "spawnIntervalMs": 570,
      "approachSpeedMul": 1.66,
      "weights": {
        "basic_meteor": 12,
        "fast_comet": 28,
        "iron_planet": 16,
        "fire_meteor": 13,
        "ice_comet": 12,
        "crystal_meteor": 9,
        "directional_comet": 9,
        "shield_rock": 6,
        "electric_meteor": 5
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2
      }
    },
    {
      "fromMs": 21000,
      "spawnIntervalMs": 535,
      "approachSpeedMul": 1.82,
      "weights": {
        "fast_comet": 26,
        "iron_planet": 16,
        "fire_meteor": 14,
        "ice_comet": 12,
        "crystal_meteor": 10,
        "directional_comet": 10,
        "shield_rock": 7,
        "electric_meteor": 6,
        "graviton_core": 4,
        "heavy_asteroid": 3
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 28000,
      "spawnIntervalMs": 500,
      "approachSpeedMul": 2,
      "weights": {
        "fast_comet": 22,
        "iron_planet": 15,
        "fire_meteor": 14,
        "ice_comet": 13,
        "crystal_meteor": 10,
        "directional_comet": 10,
        "shield_rock": 8,
        "electric_meteor": 7,
        "graviton_core": 5,
        "dark_meteor": 4,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 35000,
      "spawnIntervalMs": 470,
      "approachSpeedMul": 2.18,
      "weights": {
        "fast_comet": 20,
        "iron_planet": 14,
        "fire_meteor": 14,
        "ice_comet": 13,
        "crystal_meteor": 10,
        "directional_comet": 11,
        "shield_rock": 9,
        "electric_meteor": 8,
        "graviton_core": 6,
        "dark_meteor": 5,
        "armored_fragment": 3,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "armored_fragment": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 42000,
      "spawnIntervalMs": 445,
      "approachSpeedMul": 2.36,
      "weights": {
        "fast_comet": 18,
        "iron_planet": 13,
        "fire_meteor": 14,
        "ice_comet": 13,
        "crystal_meteor": 11,
        "directional_comet": 11,
        "shield_rock": 10,
        "electric_meteor": 9,
        "graviton_core": 7,
        "dark_meteor": 6,
        "armored_fragment": 4,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "armored_fragment": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 49000,
      "spawnIntervalMs": 420,
      "approachSpeedMul": 2.55,
      "weights": {
        "fast_comet": 16,
        "iron_planet": 12,
        "fire_meteor": 14,
        "ice_comet": 13,
        "crystal_meteor": 11,
        "directional_comet": 12,
        "shield_rock": 10,
        "electric_meteor": 10,
        "graviton_core": 8,
        "dark_meteor": 7,
        "armored_fragment": 5,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "armored_fragment": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 56000,
      "spawnIntervalMs": 400,
      "approachSpeedMul": 2.72,
      "weights": {
        "fast_comet": 14,
        "iron_planet": 11,
        "fire_meteor": 14,
        "ice_comet": 14,
        "crystal_meteor": 12,
        "directional_comet": 12,
        "shield_rock": 11,
        "electric_meteor": 10,
        "graviton_core": 9,
        "dark_meteor": 8,
        "armored_fragment": 6,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "armored_fragment": 1,
        "heavy_asteroid": 2
      }
    },
    {
      "fromMs": 63000,
      "spawnIntervalMs": 380,
      "approachSpeedMul": 2.9,
      "weights": {
        "fast_comet": 12,
        "iron_planet": 10,
        "fire_meteor": 14,
        "ice_comet": 14,
        "crystal_meteor": 12,
        "directional_comet": 13,
        "shield_rock": 12,
        "electric_meteor": 11,
        "graviton_core": 10,
        "dark_meteor": 9,
        "armored_fragment": 7,
        "heavy_asteroid": 4
      },
      "maxConsecutive": {
        "directional_comet": 2,
        "shield_rock": 2,
        "electric_meteor": 2,
        "graviton_core": 1,
        "dark_meteor": 2,
        "armored_fragment": 1,
        "heavy_asteroid": 2
      }
    }
  ]
},
  scoring: {
  "distanceMultiplier": {
    "outer": 1,
    "mid": 1.4,
    "danger": 2.2,
    "lastSave": 3.5
  },
  "accuracyMultiplier": {
    "normal": 1,
    "directional": 1.2,
    "weakCenter": 1.5,
    "bossWeak": 2
  },
  "comboMultiplier": [
    {
      "min": 1,
      "mult": 1
    },
    {
      "min": 5,
      "mult": 1.2
    },
    {
      "min": 10,
      "mult": 1.5
    },
    {
      "min": 20,
      "mult": 2
    },
    {
      "min": 30,
      "mult": 2.5
    }
  ],
  "comboGainPerSlashCap": null,
  "comboChainTimeoutMs": 650,
  "combatGaugeGainMultiplier": 1.5,
  "multiCutBonus": {
    "double": 50,
    "triple": 120,
    "mega": 400,
    "orbital_master": 1000
  },
  "gaugeGain": {
    "shard_meteor": 1,
    "small_meteor": 1,
    "basic_meteor": 2,
    "fast_comet": 2,
    "iron_planet": 3,
    "directional_comet": 3,
    "heavy_asteroid": 4,
    "ancient_planet": 4,
    "eclipse_core": 12,
    "comboKill": 2,
    "lastSave": 8,
    "directionalCut": 3,
    "bossWeakPoint": 10,
    "rescueArrive": 5
  }
},
  skills: {
  "solar_lance": {
    "gaugeCost": 72,
    "cooldownSec": 12,
    "hitDamage": 5,
    "minLengthRatio": 0.6,
    "straightnessMin": 0.9,
    "lineToEarthMaxR": 0.6,
    "endpointOutsideR": 1.5
  },
  "orbital_cut": {
    "gaugeCost": 92,
    "cooldownSec": 18,
    "hitDamage": 2,
    "radiusRatio": 4.2,
    "orbitTurnMinRad": 7.2,
    "closeMaxRatio": 0.55
  },
  "gravity_slow": {
    "gaugeCost": 70,
    "cooldownSec": 24,
    "durationMs": 2600,
    "slowMultiplier": 0.45,
    "circleTurnMinRad": 4.8,
    "closeMaxRatio": 0.3
  },
  "delta_shield": {
    "gaugeCost": 82,
    "cooldownSec": 28,
    "durationMs": 3200,
    "absorbCount": 3,
    "triangleVertexMin": 3,
    "closeMaxRatio": 0.22
  },
  "nova_pulse": {
    "gaugeCost": 64,
    "cooldownSec": 18,
    "hitDamage": 1,
    "radiusRatio": 2.7,
    "pushPx": 170,
    "targetCap": 4,
    "startNearEarthMaxR": 1.45,
    "endpointOutsideR": 2.35,
    "minPathLengthR": 1.2,
    "straightnessMin": 0.72,
    "durationMs": 650
  },
  "_debug": {
    "instantFillGauge": false,
    "infiniteGauge": false
  }
},
  ranked: {
    earthCenterX: 540,
    earthCenterY: 900,
    earthGameplayRadius: 58,
    topHudSafeY: 370,
    startVisualRadiusSafeScale: 0.7,
    rankedSpawnIntervalMultiplier: 0.9,
    periodicBossEveryMs: 75000,
    bossEnemyType: "eclipse_core",
    liveSegmentMinLengthPx: 24,
    normalSlashHitInflatePx: 12,
    solarLanceHitInflatePx: 30,
    scoreSafetyRatio: 1.08,
    scoreSafetyFlat: 2000,
    skillGaugeSafety: 120,
    skillCooldownSafetyCount: 1,
  },
} as const;

// Generated from src/game/BossDefinitions.ts; Edge replay rules must not duplicate boss weak-point data.
export const RANKED_BOSS_DEFINITIONS = {
  "eclipse_core": {
    "id": "eclipse_core",
    "labelKey": "boss.eclipse_core",
    "enemyType": "eclipse_core",
    "phases": [
      {
        "atHpRatio": 1,
        "label": "approach",
        "spawnWeightMul": 1,
        "patternKind": "ring_shards"
      },
      {
        "atHpRatio": 0.62,
        "label": "pressure",
        "spawnWeightMul": 1.2,
        "patternKind": "lane_pressure"
      },
      {
        "atHpRatio": 0.28,
        "label": "enrage",
        "spawnWeightMul": 1.45,
        "patternKind": "core_open"
      }
    ],
    "weakPoints": [
      {
        "angleDeg": 0,
        "radiusRatio": 0.28,
        "damageMultiplier": 1.35
      },
      {
        "angleDeg": 180,
        "radiusRatio": 0.42,
        "damageMultiplier": 1.2
      }
    ],
    "visualTheme": {
      "weakRingColor": 16761165,
      "weakBodyColor": 16772565,
      "weakCoreColor": 16734766,
      "weakHaloColor": 16708551,
      "telegraphColor": 16761165,
      "telegraphAccentColor": 16777215
    },
    "shardPattern": {
      "shardEnemyType": "shard_meteor",
      "warningLeadMs": 1400,
      "volleyIntervalMs": 6800,
      "count": 4,
      "spreadDeg": 110,
      "spawnRadiusOffset": 150
    }
  },
  "ringed_destroyer": {
    "id": "ringed_destroyer",
    "labelKey": "boss.ringed_destroyer",
    "enemyType": "ringed_destroyer",
    "phases": [
      {
        "atHpRatio": 1,
        "label": "approach",
        "spawnWeightMul": 1,
        "patternKind": "ring_shards",
        "objectiveKey": "boss.objective.ringed_destroyer.ring"
      },
      {
        "atHpRatio": 0.62,
        "label": "pressure",
        "spawnWeightMul": 1.25,
        "patternKind": "lane_pressure",
        "objectiveKey": "boss.objective.ringed_destroyer.body"
      },
      {
        "atHpRatio": 0.28,
        "label": "enrage",
        "spawnWeightMul": 1.55,
        "patternKind": "core_open",
        "objectiveKey": "boss.objective.ringed_destroyer.core"
      }
    ],
    "weakPoints": [
      {
        "id": "ring-a",
        "zone": "ring",
        "angleDeg": 45,
        "radiusRatio": 0.78,
        "damageMultiplier": 1.45,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "ring-b",
        "zone": "ring",
        "angleDeg": 225,
        "radiusRatio": 0.82,
        "damageMultiplier": 1.45,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "body-core",
        "zone": "body",
        "angleDeg": 180,
        "radiusRatio": 0.24,
        "damageMultiplier": 1.8,
        "activePhaseLabels": [
          "pressure",
          "enrage"
        ]
      }
    ],
    "visualTheme": {
      "weakRingColor": 6809849,
      "weakBodyColor": 16761165,
      "weakCoreColor": 16734766,
      "weakHaloColor": 16775085,
      "telegraphColor": 16752494,
      "telegraphAccentColor": 6809849
    },
    "requiresWeakPointDamage": true,
    "shardPattern": {
      "shardEnemyType": "shard_meteor",
      "warningLeadMs": 1500,
      "volleyIntervalMs": 6500,
      "count": 5,
      "spreadDeg": 78,
      "spawnRadiusOffset": 190
    }
  },
  "lava_titan": {
    "id": "lava_titan",
    "labelKey": "boss.lava_titan",
    "enemyType": "lava_titan",
    "phases": [
      {
        "atHpRatio": 1,
        "label": "approach",
        "spawnWeightMul": 1.05,
        "patternKind": "core_open",
        "objectiveKey": "boss.objective.lava_titan.cores"
      },
      {
        "atHpRatio": 0.62,
        "label": "pressure",
        "spawnWeightMul": 1.3,
        "patternKind": "lane_pressure",
        "objectiveKey": "boss.objective.lava_titan.lanes"
      },
      {
        "atHpRatio": 0.28,
        "label": "enrage",
        "spawnWeightMul": 1.65,
        "patternKind": "ring_shards",
        "objectiveKey": "boss.objective.lava_titan.enrage"
      }
    ],
    "weakPoints": [
      {
        "id": "lava-core-a",
        "zone": "core",
        "angleDeg": 30,
        "radiusRatio": 0.38,
        "damageMultiplier": 1.35,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "lava-core-b",
        "zone": "core",
        "angleDeg": 150,
        "radiusRatio": 0.42,
        "damageMultiplier": 1.35,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "lava-core-c",
        "zone": "core",
        "angleDeg": 270,
        "radiusRatio": 0.46,
        "damageMultiplier": 1.35,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "lava-heart",
        "zone": "body",
        "angleDeg": 180,
        "radiusRatio": 0.22,
        "damageMultiplier": 1.7,
        "activePhaseLabels": [
          "pressure",
          "enrage"
        ]
      }
    ],
    "visualTheme": {
      "weakRingColor": 16765286,
      "weakBodyColor": 16747069,
      "weakCoreColor": 16775085,
      "weakHaloColor": 16734766,
      "telegraphColor": 16734766,
      "telegraphAccentColor": 16765286
    },
    "requiresWeakPointDamage": true,
    "shardPattern": {
      "shardEnemyType": "fire_meteor",
      "warningLeadMs": 1200,
      "volleyIntervalMs": 5600,
      "count": 7,
      "spreadDeg": 96,
      "spawnRadiusOffset": 160
    }
  },
  "ice_colossus": {
    "id": "ice_colossus",
    "labelKey": "boss.ice_colossus",
    "enemyType": "ice_colossus",
    "phases": [
      {
        "atHpRatio": 1,
        "label": "approach",
        "spawnWeightMul": 0.95,
        "patternKind": "lane_pressure",
        "objectiveKey": "boss.objective.ice_colossus.shield"
      },
      {
        "atHpRatio": 0.62,
        "label": "pressure",
        "spawnWeightMul": 1.2,
        "patternKind": "ring_shards",
        "objectiveKey": "boss.objective.ice_colossus.cracks"
      },
      {
        "atHpRatio": 0.28,
        "label": "enrage",
        "spawnWeightMul": 1.55,
        "patternKind": "core_open",
        "objectiveKey": "boss.objective.ice_colossus.core"
      }
    ],
    "weakPoints": [
      {
        "id": "ice-shield-a",
        "zone": "ring",
        "angleDeg": 70,
        "radiusRatio": 0.72,
        "damageMultiplier": 1.25,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "ice-shield-b",
        "zone": "ring",
        "angleDeg": 250,
        "radiusRatio": 0.74,
        "damageMultiplier": 1.25,
        "activePhaseLabels": [
          "approach"
        ]
      },
      {
        "id": "ice-crack",
        "zone": "body",
        "angleDeg": 260,
        "radiusRatio": 0.48,
        "damageMultiplier": 1.45,
        "activePhaseLabels": [
          "pressure"
        ]
      },
      {
        "id": "ice-core",
        "zone": "core",
        "angleDeg": 90,
        "radiusRatio": 0.2,
        "damageMultiplier": 1.75,
        "activePhaseLabels": [
          "enrage"
        ]
      }
    ],
    "visualTheme": {
      "weakRingColor": 12248829,
      "weakBodyColor": 3718648,
      "weakCoreColor": 16777215,
      "weakHaloColor": 8246268,
      "telegraphColor": 3718648,
      "telegraphAccentColor": 14742270
    },
    "requiresWeakPointDamage": true,
    "shardPattern": {
      "shardEnemyType": "ice_comet",
      "warningLeadMs": 1500,
      "volleyIntervalMs": 7200,
      "count": 4,
      "spreadDeg": 120,
      "spawnRadiusOffset": 210
    }
  },
  "dark_planet": {
    "id": "dark_planet",
    "labelKey": "boss.dark_planet",
    "enemyType": "dark_planet",
    "phases": [
      {
        "atHpRatio": 1,
        "label": "approach",
        "spawnWeightMul": 1.05,
        "patternKind": "lane_pressure",
        "objectiveKey": "boss.objective.dark_planet.shadow"
      },
      {
        "atHpRatio": 0.62,
        "label": "pressure",
        "spawnWeightMul": 1.35,
        "patternKind": "core_open",
        "objectiveKey": "boss.objective.dark_planet.falseWeak"
      },
      {
        "atHpRatio": 0.28,
        "label": "enrage",
        "spawnWeightMul": 1.75,
        "patternKind": "ring_shards",
        "objectiveKey": "boss.objective.dark_planet.trueCore"
      }
    ],
    "weakPoints": [
      {
        "id": "dark-decoy-a",
        "zone": "body",
        "angleDeg": 120,
        "radiusRatio": 0.44,
        "damageMultiplier": 1.05,
        "activePhaseLabels": [
          "approach",
          "pressure"
        ]
      },
      {
        "id": "dark-decoy-b",
        "zone": "body",
        "angleDeg": 240,
        "radiusRatio": 0.44,
        "damageMultiplier": 1.05,
        "activePhaseLabels": [
          "approach",
          "pressure"
        ]
      },
      {
        "id": "dark-true-core",
        "zone": "core",
        "angleDeg": 0,
        "radiusRatio": 0.24,
        "damageMultiplier": 1.85,
        "activePhaseLabels": [
          "enrage"
        ]
      }
    ],
    "visualTheme": {
      "weakRingColor": 11032055,
      "weakBodyColor": 12616956,
      "weakCoreColor": 15772668,
      "weakHaloColor": 8490232,
      "telegraphColor": 9133302,
      "telegraphAccentColor": 15772668
    },
    "requiresWeakPointDamage": true,
    "shardPattern": {
      "shardEnemyType": "dark_meteor",
      "warningLeadMs": 1300,
      "volleyIntervalMs": 6000,
      "count": 6,
      "spreadDeg": 180,
      "spawnRadiusOffset": 170
    }
  }
} as const;

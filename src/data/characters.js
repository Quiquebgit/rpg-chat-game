export const characters = [
  {
    id: 'darro',
    name: 'Darro',
    role: 'Capitán',
    combatStyle: 'Combate cuerpo a cuerpo, bastón de hierro',
    hp: 8,
    attack: 3,
    defense: 3,
    navigation: 3,
    ability: {
      name: 'Liderazgo',
      description: 'Da +2 ataque o +2 defensa a un aliado durante un combate'
    }
  },
  {
    id: 'shin',
    name: 'Shin',
    role: 'Espadachín',
    combatStyle: 'Una espada, técnicas de presión de aire',
    hp: 6,
    attack: 5,
    defense: 1,
    navigation: 2,
    ability: {
      name: 'Onda de presión',
      description: 'Ataque a distancia sin acercarse, ignora 1 de defensa enemiga'
    }
  },
  {
    id: 'vela',
    name: 'Vela',
    role: 'Médico',
    combatStyle: 'Agujas y venenos, conocimiento del cuerpo',
    hp: 5,
    attack: 2,
    defense: 2,
    navigation: 2,
    ability: {
      name: 'Tratamiento',
      description: 'Cura 2 de vida en combate, o 4 fuera de combate'
    }
  },
  {
    id: 'crann',
    name: 'Crann',
    role: 'Francotirador',
    combatStyle: 'Ballesta de precisión, trampas',
    hp: 5,
    attack: 5,
    defense: 1,
    navigation: 3,
    ability: {
      name: 'Emboscada',
      description: 'Si actúa antes de ser detectado, dobla su ataque ese turno'
    }
  },
  {
    id: 'lissa',
    name: 'Lissa',
    role: 'Navegante',
    combatStyle: 'Cadenas y pesas, lectura del viento',
    hp: 6,
    attack: 3,
    defense: 2,
    navigation: 5,
    ability: {
      name: 'Lectura del mar',
      description: 'Puede evitar un encuentro peligroso en viaje una vez por sesión'
    }
  },
  {
    id: 'brek',
    name: 'Brek',
    role: 'Cocinero',
    combatStyle: 'Patadas explosivas, cuchillos de cocina como proyectiles',
    hp: 7,
    attack: 4,
    defense: 2,
    navigation: 1,
    ability: {
      name: 'Festín',
      description: 'Fuera de combate, cocina para restaurar 1 de vida a toda la tripulación'
    }
  }
]
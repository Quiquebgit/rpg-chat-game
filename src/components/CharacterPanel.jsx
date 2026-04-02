import { useState } from 'react'
import { XP_CONFIG, STAT_LABELS } from '../data/constants'
import { CollapsibleAbility } from './CollapsibleAbility'
import { InventoryPanel, DebugInventoryButton } from './InventoryPanel'
import { StatRow } from './StatRow'

const TABS = [
  { id: 'personaje', label: 'Personaje', icon: '⚔️' },
  { id: 'poderes',   label: 'Poderes',   icon: '✨' },
  { id: 'mochila',   label: 'Mochila',   icon: '🎒' },
]

export function CharacterPanel({
  character,
  isDead,
  hasFruit,
  fruitFlash,
  equippedFruit,
  hpCurrent,
  equipmentBonuses,
  combatBoosts,
  statUpgrades,
  currentMoney,
  currentXp,
  xpProgress,
  gameMode,
  inventory,
  isMyTurn,
  presentedCharacters,
  onUseItem,
  onGiftItem,
  onDebugAddItem,
}) {
  const [activeTab, setActiveTab] = useState('personaje')
  const [sheetOpen, setSheetOpen] = useState(false)

  const hpPercent = character.hp > 0 ? (hpCurrent / character.hp) * 100 : 0

  const activeCombatBoosts = Object.entries(combatBoosts || {})
    .filter(([, v]) => v !== 0)

  function renderTabBar() {
    return (
      <div className="flex border-b border-gray-800 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? 'text-amber-300 border-b-2 border-amber-400'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>
    )
  }

  function renderPersonaje() {
    return (
      <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
        {/* Nombre y rol */}
        <div className={`relative rounded-lg p-3 transition-all duration-300 ${isDead ? 'opacity-60' : ''} ${fruitFlash ? 'ring-2 ring-purple-400 bg-purple-400/10 animate-pulse' : hasFruit ? 'ring-1 ring-purple-500/40' : ''}`}>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Jugando como</p>
          <div className="flex items-center gap-2">
            <h2 className={`text-2xl font-bold ${isDead ? 'line-through text-gray-500' : 'text-amber-300'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {character.name}
            </h2>
            {isDead && <span title="Fuera de combate" className="text-xl leading-none">☠️</span>}
            {!isDead && hasFruit && (
              <span title="Portador de fruta del diablo" className="text-lg leading-none">🍎</span>
            )}
          </div>
          <p className={`text-sm uppercase tracking-widest ${isDead ? 'text-gray-600' : 'text-gray-400'}`}>{character.role}</p>
          <p className="text-xs text-gray-600 italic mt-1">{character.combatStyle}</p>
          {isDead && (
            <p className="text-xs text-red-400/70 mt-1 font-semibold">— Fuera de combate —</p>
          )}
        </div>

        {/* HP barra */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs uppercase tracking-widest text-gray-500">❤️ Vida</p>
            <span className={`text-sm font-bold ${hpCurrent <= 1 ? 'text-red-400' : hpCurrent <= character.hp / 2 ? 'text-yellow-400' : 'text-green-400'}`}>
              {hpCurrent}/{character.hp}
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                hpPercent > 50 ? 'bg-green-500' :
                hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(hpPercent, 0)}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Stats</p>
          <div className="flex flex-col gap-3">
            <StatRow icon="⚔️" label="Ataque"     value={character.attack}     bonus={(equipmentBonuses.attack     || 0) + (combatBoosts.attack     || 0)} color="bg-amber-400" />
            <StatRow icon="🛡️" label="Defensa"    value={character.defense}    bonus={(equipmentBonuses.defense    || 0) + (combatBoosts.defense    || 0)} color="bg-blue-400" />
            <StatRow icon="⚓" label="Navegación" value={character.navigation} bonus={(equipmentBonuses.navigation || 0) + (combatBoosts.navigation || 0)} color="bg-green-400" />
            <StatRow icon="🎯" label="Destreza"   value={character.dexterity ?? 0} bonus={(equipmentBonuses.dexterity || 0) + (combatBoosts.dexterity || 0) + (statUpgrades.dexterity || 0)} color="bg-orange-400" />
            <StatRow icon="💬" label="Carisma"    value={character.charisma   ?? 0} bonus={(equipmentBonuses.charisma  || 0) + (combatBoosts.charisma  || 0) + (statUpgrades.charisma  || 0)} color="bg-pink-400" />
          </div>
        </div>

        {/* Economía */}
        <div className="border border-amber-400/20 rounded-lg p-3 bg-amber-400/5">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">Economía</p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">💰 Berries</span>
              <span className="text-amber-300 font-semibold">{currentMoney.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">☠️ Recompensa</span>
              <span className="text-red-300 font-semibold">{character.bounty?.toLocaleString() ?? 0} B</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>⭐ XP</span>
              <span>{currentXp} (+{xpProgress}/{XP_CONFIG.THRESHOLD})</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                style={{ width: `${(xpProgress / XP_CONFIG.THRESHOLD) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderPoderes() {
    return (
      <div className="flex flex-col gap-4 p-5 overflow-y-auto flex-1">
        <CollapsibleAbility
          label="Habilidad especial"
          name={character.ability.name}
          description={character.ability.description}
          borderColor="border-amber-400/40"
          bgColor="bg-amber-400/5"
          labelColor="text-amber-500/70"
          nameColor="text-amber-300"
        />
        {equippedFruit?.special_ability && (
          <CollapsibleAbility
            label="🍎 Poder de fruta"
            name={equippedFruit.name}
            description={equippedFruit.special_ability}
            effects={equippedFruit.effects}
            borderColor="border-purple-400/40"
            bgColor="bg-purple-400/5"
            labelColor="text-purple-500/70"
            nameColor="text-purple-300"
          />
        )}

        {activeCombatBoosts.length > 0 && (
          <div className="rounded-lg border border-green-400/30 bg-green-400/5 p-3">
            <p className="text-xs uppercase tracking-widest text-green-500/70 mb-2">Boosts activos</p>
            <div className="flex flex-col gap-1.5">
              {activeCombatBoosts.map(([stat, val]) => (
                <div key={stat} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{STAT_LABELS[stat] ?? stat}</span>
                  <span className={`font-bold ${val > 0 ? 'text-green-300' : 'text-red-400'}`}>
                    {val > 0 ? `+${val}` : val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeCombatBoosts.length === 0 && !equippedFruit?.special_ability && (
          <p className="text-xs text-gray-600 italic text-center mt-4">Sin poderes activos</p>
        )}
      </div>
    )
  }

  function renderMochila() {
    return (
      <div className="flex flex-col gap-2 p-5 overflow-y-auto flex-1">
        <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">Inventario</p>
        <InventoryPanel
          inventory={inventory}
          isMyTurn={isMyTurn}
          allies={presentedCharacters.filter(c => c.id !== character.id)}
          onUse={(item, i) => onUseItem(item, i)}
          onGift={onGiftItem}
        />
        {import.meta.env.DEV && onDebugAddItem && (
          <DebugInventoryButton onAdd={onDebugAddItem} />
        )}
      </div>
    )
  }

  const panelContent = (
    <div className="flex flex-col h-full">
      {renderTabBar()}
      {activeTab === 'personaje' && renderPersonaje()}
      {activeTab === 'poderes'   && renderPoderes()}
      {activeTab === 'mochila'   && renderMochila()}
    </div>
  )

  return (
    <>
      {/* Desktop: sidebar fijo siempre visible */}
      <aside className="hidden md:flex flex-col w-[22rem] shrink-0 bg-gray-900 border-r border-gray-800 h-full overflow-hidden">
        {panelContent}
      </aside>

      {/* Mobile: botón flotante + bottom sheet */}
      <div className="md:hidden">
        {/* Overlay para cerrar el sheet */}
        {sheetOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={() => setSheetOpen(false)}
          />
        )}

        {/* Botón flotante para abrir */}
        <button
          onClick={() => setSheetOpen(v => !v)}
          className="fixed bottom-20 left-4 z-40 bg-gray-800 border border-amber-400/30 rounded-full p-3 shadow-lg shadow-black/50 transition-colors hover:bg-gray-700"
          aria-label="Abrir panel de personaje"
        >
          <span className="text-lg leading-none">⚔️</span>
        </button>

        {/* Bottom sheet */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 rounded-t-2xl
            transition-transform duration-300 ease-in-out
            ${sheetOpen ? 'translate-y-0' : 'translate-y-full'}`}
          style={{ height: '75vh' }}
        >
          {/* Handle decorativo */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          <div className="h-[calc(100%-20px)] overflow-hidden flex flex-col">
            {panelContent}
          </div>
        </div>
      </div>
    </>
  )
}

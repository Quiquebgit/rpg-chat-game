import { useState } from 'react'
import { getRandomItem } from '../lib/items'
import { ITEM_TYPE_STYLES, ITEM_RARITY_STYLES, STAT_LABELS } from '../data/constants'

function ItemCard({ item, i, isMyTurn, allies, expanded, setExpanded, onUse, onGift, giftTarget, setGiftTarget }) {
  const style = ITEM_TYPE_STYLES[item.type] || { bg: 'bg-gray-800', border: 'border-gray-700', text: 'text-gray-400', icon: '📦' }
  const rarityClass = ITEM_RARITY_STYLES[item.rarity] || 'text-gray-600'
  const isOpen = expanded === i
  const isEquipped = item.equipped === true
  const description = item.effect || item.description
  const hasDetails = description || item.special_ability || item.effects?.length || item.cure_description
  const canGift = !isEquipped && item.target !== 'self' && allies.length > 0

  return (
    <div className={`rounded-lg border px-3 py-2 transition-all ${style.bg} ${style.border}`}>
      <button
        onClick={() => hasDetails && setExpanded(isOpen ? null : i)}
        className={`w-full text-left ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm leading-none shrink-0">{style.icon}</span>
            <span className={`text-xs font-semibold truncate ${style.text}`}>{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {item.effects?.map((e, j) => (
              <span key={j} className={`text-xs font-bold ${e.modifier > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {e.modifier > 0 ? '+' : ''}{e.modifier} {STAT_LABELS[e.stat] || e.stat}
              </span>
            ))}
            <span className={`text-xs ${rarityClass}`}>{item.rarity || 'común'}</span>
          </div>
        </div>
      </button>

      {isOpen && hasDetails && (
        <div className="mt-1.5 border-t border-white/10 pt-1.5 flex flex-col gap-1">
          {description && <p className="text-xs text-gray-400 leading-relaxed">{description}</p>}
          {item.special_ability && <p className="text-xs text-amber-300/80 leading-relaxed">✦ {item.special_ability}</p>}
          {item.cure_description && <p className="text-xs text-teal-400/80 leading-relaxed">💊 {item.cure_description}</p>}
        </div>
      )}

      {(isMyTurn && !isEquipped || canGift) && (
        <div className="mt-2 flex gap-1.5 relative">
          {isMyTurn && !isEquipped && (
            <button
              onClick={e => { e.stopPropagation(); onUse(item, i) }}
              className="flex-1 text-xs py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
            >
              {item.equippable ? 'Equipar' : 'Usar'}
            </button>
          )}
          {canGift && (
            <div className="relative">
              <button
                onClick={e => { e.stopPropagation(); setGiftTarget(giftTarget === i ? null : i) }}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-colors"
              >
                Regalar
              </button>
              {giftTarget === i && (
                <div className="absolute bottom-full right-0 mb-1 w-36 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                  {allies.map(ally => (
                    <button
                      key={ally.id}
                      onClick={e => { e.stopPropagation(); setGiftTarget(null); onGift(item, i, ally.id) }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
                    >
                      {ally.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InventoryPanel({ inventory, isMyTurn, allies = [], onUse, onGift }) {
  const [expanded, setExpanded] = useState(null)
  const [giftTarget, setGiftTarget] = useState(null)

  const isEquippedFruit = item => item.is_fruit || (item.type === 'fruta' && item.equipped)
  const equipped = inventory.map((item, i) => ({ item, i })).filter(({ item }) => item.equippable && item.equipped && !isEquippedFruit(item))
  const backpack = inventory.map((item, i) => ({ item, i })).filter(({ item }) => !isEquippedFruit(item) && !(item.equippable && item.equipped))
  if (!equipped.length && !backpack.length) return <p className="text-xs text-gray-600 italic">Sin objetos</p>

  const cardProps = { isMyTurn, allies, expanded, setExpanded, onUse, onGift, giftTarget, setGiftTarget }

  return (
    <div className="flex flex-col gap-3">
      {equipped.length > 0 && (
        <div>
          <p className="text-xs text-amber-400/60 uppercase tracking-wider mb-1.5">⚔️ Equipado</p>
          <div className="flex flex-col gap-1.5">
            {equipped.map(({ item, i }) => <ItemCard key={i} item={item} i={i} {...cardProps} />)}
          </div>
        </div>
      )}
      {backpack.length > 0 && (
        <div>
          <p className="text-xs text-gray-500/60 uppercase tracking-wider mb-1.5">🎒 Mochila</p>
          <div className="flex flex-col gap-1.5">
            {backpack.map(({ item, i }) => <ItemCard key={i} item={item} i={i} {...cardProps} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// Botón de debug solo visible en desarrollo — obtiene item aleatorio real de la BD
const DEBUG_TYPES = ['arma', 'equipo', 'consumible', 'fruta']

export function DebugInventoryButton({ onAdd }) {
  const [loading, setLoading] = useState(false)
  async function handleAdd() {
    setLoading(true)
    const type = DEBUG_TYPES[Math.floor(Math.random() * DEBUG_TYPES.length)]
    const item = await getRandomItem({ type })
    if (item) onAdd(item)
    setLoading(false)
  }
  return (
    <button
      onClick={handleAdd}
      disabled={loading}
      className="mt-2 w-full text-xs text-gray-600 border border-dashed border-gray-800 rounded-lg py-1.5 hover:text-gray-400 hover:border-gray-700 disabled:opacity-40 transition-colors"
    >
      {loading ? 'cargando…' : '+ debug: añadir item'}
    </button>
  )
}

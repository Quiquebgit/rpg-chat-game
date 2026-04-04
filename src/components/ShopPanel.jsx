// Panel de tienda: muestra items con precio disponibles para comprar
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ITEM_TYPE_STYLES } from '../data/constants'

export function ShopPanel({ currentMoney, onBuyItem, sessionSuppliesDays }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(null) // id del item siendo comprado
  const [feedback, setFeedback] = useState(null) // { itemId, text }

  useEffect(() => {
    async function loadShopItems() {
      const { data } = await supabase
        .from('items')
        .select('*')
        .not('price', 'is', null)
        .order('type')
        .order('price')
      setItems(data || [])
      setLoading(false)
    }
    loadShopItems()
  }, [])

  async function handleBuy(item) {
    if (buying || currentMoney < item.price) return
    setBuying(item.id)
    await onBuyItem(item)
    setFeedback({ itemId: item.id, text: '¡Comprado!' })
    setTimeout(() => setFeedback(null), 2000)
    setBuying(null)
  }

  const supplyItems = items.filter(i => i.effects?.supply_days > 0)
  const equipItems = items.filter(i => !i.effects?.supply_days)

  if (loading) {
    return <p className="text-sm text-ink-off text-center py-8 animate-pulse">Cargando tienda…</p>
  }

  if (items.length === 0) {
    return <p className="text-sm text-ink-off text-center py-8 italic">La tienda está vacía por ahora.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Saldo actual */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-ink-3">Tu saldo</span>
        <span className="text-sm font-bold text-gold-bright">💰 {currentMoney.toLocaleString()} B</span>
      </div>

      {/* Suministros del barco */}
      {supplyItems.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-ink-3 mb-2">
            🧳 Suministros del barco
            {sessionSuppliesDays != null && (
              <span className="ml-2 text-navigation-light font-semibold">{sessionSuppliesDays} días restantes</span>
            )}
          </p>
          <div className="flex flex-col gap-2">
            {supplyItems.map(item => (
              <ShopItem
                key={item.id}
                item={item}
                currentMoney={currentMoney}
                buying={buying}
                feedback={feedback}
                onBuy={handleBuy}
                borderClass="border-navigation/30 bg-navigation/5"
              />
            ))}
          </div>
        </div>
      )}

      {/* Equipamiento e items */}
      {equipItems.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-ink-3 mb-2">⚔️ Equipamiento e items</p>
          <div className="flex flex-col gap-2">
            {equipItems.map(item => {
              const typeStyle = ITEM_TYPE_STYLES[item.type] || ITEM_TYPE_STYLES.consumible
              return (
                <ShopItem
                  key={item.id}
                  item={item}
                  currentMoney={currentMoney}
                  buying={buying}
                  feedback={feedback}
                  onBuy={handleBuy}
                  borderClass={`${typeStyle.border} ${typeStyle.bg}`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ShopItem({ item, currentMoney, buying, feedback, onBuy, borderClass }) {
  const canAfford = currentMoney >= item.price
  const isBuying = buying === item.id
  const wasBought = feedback?.itemId === item.id

  return (
    <div className={`rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3 ${borderClass}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
        {item.description && (
          <p className="text-[11px] text-ink-3 leading-tight mt-0.5 line-clamp-2">{item.description}</p>
        )}
        {item.effects?.supply_days && (
          <p className="text-[10px] text-navigation-light mt-0.5">+{item.effects.supply_days} días de suministros</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-bold text-gold-bright">{item.price?.toLocaleString()} B</span>
        <button
          onClick={() => onBuy(item)}
          disabled={!canAfford || isBuying}
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all ${
            wasBought
              ? 'bg-exploration/20 text-exploration-light border border-exploration/30'
              : canAfford && !isBuying
                ? 'bg-gold text-canvas hover:bg-gold-bright'
                : 'bg-raised text-ink-off border border-stroke opacity-40 cursor-not-allowed'
          }`}
        >
          {wasBought ? '✓ Comprado' : isBuying ? '…' : 'Comprar'}
        </button>
      </div>
    </div>
  )
}

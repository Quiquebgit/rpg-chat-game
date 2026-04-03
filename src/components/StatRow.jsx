export function StatRow({ icon, label, value, bonus = 0, color }) {
  const total = value + bonus
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs text-ink-3">{icon} {label}</p>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-ink-2">{value}</span>
          {bonus !== 0 && (
            <>
              <span className={`text-xs font-bold ${bonus > 0 ? 'text-gold' : 'text-degree-failure'}`}>
                {bonus > 0 ? `+${bonus}` : bonus}
              </span>
              <span className="text-xs text-ink-off">=</span>
              <span className="text-xs font-bold text-ink">{total}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1 items-center flex-wrap">
        {Array.from({ length: value }).map((_, i) => (
          <div
            key={i}
            className={`h-4 w-3 ${color} shrink-0 rotate-45`}
            style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }}
          />
        ))}
        {Array.from({ length: Math.abs(bonus) }).map((_, i) => (
          <div
            key={`b${i}`}
            className={`h-4 w-3 shrink-0 rotate-45 ${bonus > 0 ? 'bg-gold' : 'bg-degree-failure'}`}
            style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)', opacity: 0.6 }}
          />
        ))}
      </div>
    </div>
  )
}

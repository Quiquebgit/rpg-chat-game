export function StatRow({ icon, label, value, bonus = 0, color }) {
  const total = value + bonus
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs text-gray-500">{icon} {label}</p>
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-gray-400">{value}</span>
          {bonus !== 0 && (
            <>
              <span className={`text-xs font-bold ${bonus > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {bonus > 0 ? `+${bonus}` : bonus}
              </span>
              <span className="text-xs text-gray-600">=</span>
              <span className="text-xs font-bold text-white">{total}</span>
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
            className={`h-4 w-3 shrink-0 rotate-45 ${bonus > 0 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)', opacity: 0.6 }}
          />
        ))}
      </div>
    </div>
  )
}

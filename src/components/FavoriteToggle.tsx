import { copy } from '../copy'
import type { Intent, RoutePack } from '../router/types.ts'
import { routeFavoriteId, toggleRoute, useFavorites } from '../state/favorites'
import { HeartButton } from './HeartButton'

/** Heart for a trip. Whether it is saved is read live from the device, so every heart for the same trip agrees. */
export function FavoriteToggle({ intent, pack, className = '' }: { intent: Intent; pack: RoutePack | null; className?: string }) {
  const favorites = useFavorites()
  const id = routeFavoriteId(intent)
  const saved = favorites.some((favorite) => favorite.id === id)
  return (
    <HeartButton
      saved={saved}
      testId="fav-route-toggle"
      label={saved ? copy.fav.removeRoute : copy.fav.saveRoute}
      onToggle={() => void toggleRoute(intent, pack)}
      className={className}
    />
  )
}

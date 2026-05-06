import { registerItemCoreIPC } from './core'
import { registerItemImportIPC } from './imports'
import { registerItemMetadataIPC } from './metadata'
import { registerItemProfileMoveIPC } from './profileMove'
import { registerItemRelinkIPC } from './relink'
import type { DB } from './utils'

export function registerItemsIPC(db: DB) {
  registerItemCoreIPC(db)
  registerItemRelinkIPC(db)
  registerItemProfileMoveIPC(db)
  registerItemImportIPC(db)
  registerItemMetadataIPC(db)
}

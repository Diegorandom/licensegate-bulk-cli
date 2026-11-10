import type { LicenseGateLicense, LicenseGateLicenseUpdateInput } from '../types'

export function mergeWithCurrentLicense(input: LicenseGateLicenseUpdateInput, current: LicenseGateLicense) {
  const merged: LicenseGateLicenseUpdateInput = { ...input }
  if (merged.ipLimit === undefined && current.ipLimit !== null) merged.ipLimit = current.ipLimit
  if (merged.licenseScope === undefined && current.licenseScope !== null) merged.licenseScope = current.licenseScope
  if (merged.validationPoints === undefined && current.validationPoints !== null) merged.validationPoints = current.validationPoints
  if (merged.validationLimit === undefined && current.validationLimit !== null) merged.validationLimit = current.validationLimit
  if (merged.replenishAmount === undefined && current.replenishAmount !== null) merged.replenishAmount = current.replenishAmount
  if (merged.replenishInterval === undefined && current.replenishInterval !== null) merged.replenishInterval = current.replenishInterval
  // La API exige una fecha válida en el PATCH: si el cuerpo no trae
  // `expirationDate`, responde 422 invalid-schema con «value null». Medido el
  // 2026-11-10 sobre 214 actualizaciones que sólo cambiaban `notes`: fallaron
  // las 214. Una actualización que no toca la fecha tiene que reenviar la que
  // la licencia ya tiene. Si la licencia no tiene fecha, se deja fuera: inventar
  // una sería peor que fallar, porque le pondría caducidad a una perpetua.
  if (merged.expirationDate === undefined && current.expirationDate !== null) {
    merged.expirationDate = current.expirationDate
  }
  return merged
}

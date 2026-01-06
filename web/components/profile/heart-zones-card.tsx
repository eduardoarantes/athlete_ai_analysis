'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  HEART_ZONES,
  calculateZonesForMaxHr,
  calculateZonesWithHrReserve,
  type HeartZoneWithBpm,
  type CustomHeartZoneConfig,
} from '@/lib/types/heart-zones'
import { cn } from '@/lib/utils'
import { Heart, RotateCcw, Pencil, Check, X, Info } from 'lucide-react'

interface HeartZonesCardProps {
  maxHr: number | null
  restingHr?: number | null
  customZones?: CustomHeartZoneConfig[] | null
  onSaveCustomZones?: (zones: CustomHeartZoneConfig[]) => Promise<void>
  className?: string
}

/**
 * Full heart rate zones display card for the profile page.
 * Shows zones based on Max HR with ability to edit zone thresholds.
 * Optionally uses Karvonen formula when resting HR is available.
 */
export function HeartZonesCard({
  maxHr,
  restingHr,
  customZones,
  onSaveCustomZones,
  className,
}: HeartZonesCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedZones, setEditedZones] = useState<CustomHeartZoneConfig[]>([])
  const [useHrReserve, setUseHrReserve] = useState(!!restingHr)
  const [isSaving, setIsSaving] = useState(false)

  // Calculate zones based on Max HR (custom or default)
  const zones = useMemo(() => {
    if (!maxHr) return null

    // If we have custom zones, use them
    if (customZones && customZones.length > 0) {
      return customZones.map((custom) => {
        const baseZone = HEART_ZONES.find((z) => z.zone === custom.zone) ?? HEART_ZONES[0]!
        const effectiveMaxHr = useHrReserve && restingHr ? maxHr - restingHr : maxHr
        const baseHr = useHrReserve && restingHr ? restingHr : 0

        return {
          ...baseZone,
          minPct: custom.minPct,
          maxPct: custom.maxPct,
          minBpm: Math.round(baseHr + (custom.minPct / 100) * effectiveMaxHr),
          maxBpm: Math.round(baseHr + (custom.maxPct / 100) * effectiveMaxHr),
        }
      })
    }

    // Otherwise use defaults
    if (useHrReserve && restingHr) {
      return calculateZonesWithHrReserve(maxHr, restingHr)
    }
    return calculateZonesForMaxHr(maxHr)
  }, [maxHr, restingHr, customZones, useHrReserve])

  // Initialize edited zones when entering edit mode
  const startEditing = useCallback(() => {
    const initialZones: CustomHeartZoneConfig[] =
      customZones && customZones.length > 0
        ? customZones
        : HEART_ZONES.map((z) => ({
            zone: z.zone,
            minPct: z.minPct,
            maxPct: z.maxPct,
          }))
    setEditedZones(initialZones)
    setIsEditing(true)
  }, [customZones])

  const cancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditedZones([])
  }, [])

  const resetToDefaults = useCallback(() => {
    setEditedZones(
      HEART_ZONES.map((z) => ({
        zone: z.zone,
        minPct: z.minPct,
        maxPct: z.maxPct,
      }))
    )
  }, [])

  const handleZoneChange = useCallback(
    (index: number, field: 'minPct' | 'maxPct', value: string) => {
      setEditedZones((prev) => {
        const newZones = [...prev]
        const numValue = value === '' ? 0 : parseInt(value, 10)

        newZones[index] = {
          ...newZones[index]!,
          [field]: numValue,
        }

        return newZones
      })
    },
    []
  )

  const handleSave = useCallback(async () => {
    if (!onSaveCustomZones) return

    setIsSaving(true)
    try {
      await onSaveCustomZones(editedZones)
      setIsEditing(false)
    } catch {
      // Error handling is done by the parent
    } finally {
      setIsSaving(false)
    }
  }, [editedZones, onSaveCustomZones])

  // Calculate preview zones when editing
  const previewZones = useMemo(() => {
    if (!isEditing || !maxHr) return null

    const effectiveMaxHr = useHrReserve && restingHr ? maxHr - restingHr : maxHr
    const baseHr = useHrReserve && restingHr ? restingHr : 0

    return editedZones.map((edited) => {
      const baseZone = HEART_ZONES.find((z) => z.zone === edited.zone) ?? HEART_ZONES[0]!
      return {
        ...baseZone,
        minPct: edited.minPct,
        maxPct: edited.maxPct,
        minBpm: Math.round(baseHr + (edited.minPct / 100) * effectiveMaxHr),
        maxBpm: Math.round(baseHr + (edited.maxPct / 100) * effectiveMaxHr),
      }
    })
  }, [isEditing, editedZones, maxHr, restingHr, useHrReserve])

  if (!maxHr) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Heart Rate Zones</CardTitle>
              <CardDescription>Set your Max HR to see your training zones</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Heart rate zones are calculated based on your Maximum Heart Rate. Update your Max HR in
            the Performance Metrics section above to view your personalized zones.
          </p>
        </CardContent>
      </Card>
    )
  }

  const displayZones = isEditing ? previewZones : zones

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Heart className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Heart Rate Zones</CardTitle>
              <CardDescription>
                Max HR: {maxHr} bpm
                {restingHr ? ` | Resting: ${restingHr} bpm` : ''}
              </CardDescription>
            </div>
          </div>
          {!isEditing && onSaveCustomZones && (
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={resetToDefaults}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Check className="h-4 w-4 mr-1" />
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Karvonen Formula Toggle */}
        {restingHr && !isEditing && (
          <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Use Heart Rate Reserve</p>
                <p className="text-xs text-muted-foreground">
                  Karvonen formula for more accurate zones
                </p>
              </div>
            </div>
            <Switch checked={useHrReserve} onCheckedChange={setUseHrReserve} />
          </div>
        )}

        {isEditing ? (
          <div className="space-y-3">
            {editedZones.map((zone, index) => (
              <EditableHeartZoneRow
                key={zone.zone}
                zone={zone}
                previewZone={previewZones?.[index]}
                onChange={(field, value) => handleZoneChange(index, field, value)}
              />
            ))}
            <p className="text-xs text-muted-foreground mt-4">
              Adjust zone thresholds as percentages of your{' '}
              {useHrReserve ? 'heart rate reserve' : 'max HR'}. Click Reset to restore default
              values.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Zone</th>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-right font-medium">BPM Range</th>
                  <th className="px-3 py-2 text-right font-medium">
                    % {useHrReserve ? 'HRR' : 'Max'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayZones?.map((zone) => (
                  <tr key={zone.zone} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold',
                          zone.bgClass,
                          zone.textClass
                        )}
                      >
                        {zone.zone}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{zone.name}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {zone.minBpm}-{zone.maxBpm} bpm
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                      {zone.minPct}-{zone.maxPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface EditableHeartZoneRowProps {
  zone: CustomHeartZoneConfig
  previewZone: HeartZoneWithBpm | undefined
  onChange: (field: 'minPct' | 'maxPct', value: string) => void
}

function EditableHeartZoneRow({ zone, previewZone, onChange }: EditableHeartZoneRowProps) {
  const baseZone = HEART_ZONES.find((z) => z.zone === zone.zone) ?? HEART_ZONES[0]!

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
      <span
        className={cn(
          'inline-flex items-center justify-center w-10 h-8 rounded text-sm font-bold flex-shrink-0',
          baseZone.bgClass,
          baseZone.textClass
        )}
      >
        {zone.zone}
      </span>
      <span className="flex-1 text-sm font-medium min-w-0 truncate">{baseZone.name}</span>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground sr-only">Min %</Label>
          <Input
            type="number"
            value={zone.minPct}
            onChange={(e) => onChange('minPct', e.target.value)}
            className="w-16 h-8 text-xs text-center"
            min={0}
            max={100}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground sr-only">Max %</Label>
          <Input
            type="number"
            value={zone.maxPct}
            onChange={(e) => onChange('maxPct', e.target.value)}
            className="w-16 h-8 text-xs text-center"
            min={0}
            max={100}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      {previewZone && (
        <span className="text-xs text-muted-foreground font-mono w-24 text-right">
          {previewZone.minBpm}-{previewZone.maxBpm} bpm
        </span>
      )}
    </div>
  )
}

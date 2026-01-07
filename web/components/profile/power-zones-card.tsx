'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  POWER_ZONES,
  calculateZonesForFtp,
  type ZoneWithWattage,
  type CustomZoneConfig,
} from '@/lib/types/power-zones'
import { cn } from '@/lib/utils'
import { Zap, RotateCcw, Pencil, Check, X } from 'lucide-react'

interface PowerZonesCardProps {
  ftp: number | null
  customZones?: CustomZoneConfig[] | null
  onSaveCustomZones?: (zones: CustomZoneConfig[]) => Promise<void>
  className?: string
}

/**
 * Full power zones display card for the profile page.
 * Shows zones based on FTP with ability to edit zone thresholds.
 */
export function PowerZonesCard({
  ftp,
  customZones,
  onSaveCustomZones,
  className,
}: PowerZonesCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedZones, setEditedZones] = useState<CustomZoneConfig[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Calculate zones based on FTP (custom or default)
  const zones = useMemo(() => {
    if (!ftp) return null

    // If we have custom zones, use them
    if (customZones && customZones.length > 0) {
      return customZones.map((custom) => {
        const baseZone = POWER_ZONES.find((z) => z.zone === custom.zone) ?? POWER_ZONES[0]!
        return {
          ...baseZone,
          minPct: custom.minPct,
          maxPct: custom.maxPct,
          minWatts: Math.round((custom.minPct / 100) * ftp),
          maxWatts: custom.maxPct !== null ? Math.round((custom.maxPct / 100) * ftp) : null,
        }
      })
    }

    // Otherwise use defaults
    return calculateZonesForFtp(ftp)
  }, [ftp, customZones])

  // Initialize edited zones when entering edit mode
  const startEditing = useCallback(() => {
    const initialZones: CustomZoneConfig[] =
      customZones && customZones.length > 0
        ? customZones
        : POWER_ZONES.map((z) => ({
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
      POWER_ZONES.map((z) => ({
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

        if (field === 'maxPct') {
          // Z6 has no upper limit
          newZones[index] = {
            ...newZones[index]!,
            maxPct: index === 5 ? null : numValue,
          }
        } else {
          newZones[index] = {
            ...newZones[index]!,
            minPct: numValue,
          }
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
    if (!isEditing || !ftp) return null

    return editedZones.map((edited) => {
      const baseZone = POWER_ZONES.find((z) => z.zone === edited.zone) ?? POWER_ZONES[0]!
      return {
        ...baseZone,
        minPct: edited.minPct,
        maxPct: edited.maxPct,
        minWatts: Math.round((edited.minPct / 100) * ftp),
        maxWatts: edited.maxPct !== null ? Math.round((edited.maxPct / 100) * ftp) : null,
      }
    })
  }, [isEditing, editedZones, ftp])

  if (!ftp) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Power Zones</CardTitle>
              <CardDescription>Set your FTP to see your training zones</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Power zones are calculated based on your Functional Threshold Power (FTP). Update your
            FTP in the Performance Metrics section above to view your personalized zones.
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
            <div className="h-8 w-8 rounded-md bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Power Zones</CardTitle>
              <CardDescription>Based on FTP: {ftp}W</CardDescription>
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
        {isEditing ? (
          <div className="space-y-3">
            {editedZones.map((zone, index) => (
              <EditableZoneRow
                key={zone.zone}
                zone={zone}
                previewZone={previewZones?.[index]}
                onChange={(field, value) => handleZoneChange(index, field, value)}
              />
            ))}
            <p className="text-xs text-muted-foreground mt-4">
              Adjust zone thresholds as percentages of your FTP. Click Reset to restore default
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
                  <th className="px-3 py-2 text-right font-medium">Power Range</th>
                  <th className="px-3 py-2 text-right font-medium">% FTP</th>
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
                      {zone.maxWatts === null
                        ? `${zone.minWatts}W+`
                        : `${zone.minWatts}-${zone.maxWatts}W`}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground font-mono">
                      {zone.maxPct === null ? `${zone.minPct}%+` : `${zone.minPct}-${zone.maxPct}%`}
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

interface EditableZoneRowProps {
  zone: CustomZoneConfig
  previewZone: ZoneWithWattage | undefined
  onChange: (field: 'minPct' | 'maxPct', value: string) => void
}

function EditableZoneRow({ zone, previewZone, onChange }: EditableZoneRowProps) {
  const baseZone = POWER_ZONES.find((z) => z.zone === zone.zone) ?? POWER_ZONES[0]!

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
            max={200}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <span className="text-muted-foreground">-</span>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground sr-only">Max %</Label>
          {zone.maxPct === null ? (
            <span className="w-16 h-8 text-xs flex items-center justify-center text-muted-foreground">
              ∞
            </span>
          ) : (
            <Input
              type="number"
              value={zone.maxPct}
              onChange={(e) => onChange('maxPct', e.target.value)}
              className="w-16 h-8 text-xs text-center"
              min={0}
              max={300}
            />
          )}
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>
      {previewZone && (
        <span className="text-xs text-muted-foreground font-mono w-20 text-right">
          {previewZone.maxWatts === null
            ? `${previewZone.minWatts}W+`
            : `${previewZone.minWatts}-${previewZone.maxWatts}W`}
        </span>
      )}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Calendar, User, Settings, Target } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ReviewStepProps {
  data: any
}

export function ReviewStep({ data }: ReviewStepProps) {
  const t = useTranslations('createPlan.reviewStep')
  const tGoals = useTranslations('createPlan.goalStep.goals')
  const tWorkouts = useTranslations('createPlan.preferencesStep.workoutTypeOptions')
  const tProfile = useTranslations('createPlan.profileStep')
  const { goal, timeline, profile, preferences } = data

  const formatGoal = (goalId: string): string => {
    if (!goalId || goalId === 'custom') return goalId
    try {
      return tGoals(`${goalId}.label`)
    } catch {
      return goalId
    }
  }

  const formatExperience = (level: string): string => {
    try {
      return tProfile(level)
    } catch {
      return level
    }
  }

  const formatWorkoutType = (type: string): string => {
    try {
      return tWorkouts(`${type}.label`)
    } catch {
      return type
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">{t('title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>

      {/* Goal Summary */}
      {goal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              {t('trainingGoal')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{formatGoal(goal)}</Badge>
              </div>
              {data.customGoal && (
                <p className="text-sm text-muted-foreground">
                  {t('customGoal', { goal: data.customGoal })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Summary */}
      {timeline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t('timeline')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.hasEvent ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('eventType')}</span>
                  <Badge>{timeline.eventType}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('eventDate')}</span>
                  <Badge variant="outline">{new Date(timeline.eventDate).toLocaleDateString()}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('weeksUntilEvent')}</span>
                  <Badge variant="outline">{t('weeksValue', { weeks: calculateWeeks(timeline.eventDate) })}</Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('trainingDuration')}</span>
                <Badge>{t('weeksValue', { weeks: timeline.weeks })}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Profile Summary */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {t('athleteProfile')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {profile.ftp > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('ftp')}</span>
                  <Badge variant="outline">{profile.ftp}W</Badge>
                </div>
              )}
              {profile.weight > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('weight')}</span>
                  <Badge variant="outline">{profile.weight}kg</Badge>
                </div>
              )}
              {profile.ftp > 0 && profile.weight > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('wkg')}</span>
                  <Badge variant="outline">{(profile.ftp / profile.weight).toFixed(2)}</Badge>
                </div>
              )}
              {profile.weeklyHours && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('weeklyTrainingTime')}</span>
                  <Badge variant="outline">{profile.weeklyHours}</Badge>
                </div>
              )}
              {profile.experienceLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('experienceLevel')}</span>
                  <Badge variant="outline">{formatExperience(profile.experienceLevel)}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferences Summary */}
      {preferences && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('trainingPreferences')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t('trainingDaysPerWeek')}</span>
                <Badge variant="outline">{t('daysValue', { days: preferences.daysPerWeek })}</Badge>
              </div>
              {preferences.workoutTypes?.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground block mb-2">{t('workoutTypes')}</span>
                  <div className="flex flex-wrap gap-2">
                    {preferences.workoutTypes.map((type: string) => (
                      <Badge key={type} variant="secondary">
                        {formatWorkoutType(type)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {preferences.indoorOnly && (
                <Badge variant="outline">{t('indoorTrainingOnly')}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Preview */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-semibold mb-2">{t('planWillInclude')}</p>
          <ul className="space-y-1 text-sm">
            <li>• {t('planItem1', { level: formatExperience(profile?.experienceLevel || '') })}</li>
            <li>• {t('planItem2', { goal: formatGoal(goal) })}</li>
            <li>• {t('planItem3', { days: preferences?.daysPerWeek })}</li>
            <li>• {t('planItem4', { ftp: profile?.ftp })}</li>
            {timeline?.hasEvent && <li>• {t('planItem5', { eventType: timeline.eventType })}</li>}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}

function calculateWeeks(eventDate: string): number {
  const event = new Date(eventDate)
  const now = new Date()
  const diffTime = Math.abs(event.getTime() - now.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7))
}

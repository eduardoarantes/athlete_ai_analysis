'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Bike,
  Brain,
  Target,
  TrendingUp,
  Zap,
  Users,
  BarChart3,
  Heart,
  Mountain,
  Timer,
  Award,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

export default function Home() {
  const t = useTranslations('aboutPage')

  const features = [
    {
      icon: Brain,
      titleKey: 'features.aiCoach.title',
      descriptionKey: 'features.aiCoach.description',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: BarChart3,
      titleKey: 'features.performanceAnalysis.title',
      descriptionKey: 'features.performanceAnalysis.description',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Target,
      titleKey: 'features.trainingPlans.title',
      descriptionKey: 'features.trainingPlans.description',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Zap,
      titleKey: 'features.powerZones.title',
      descriptionKey: 'features.powerZones.description',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      icon: Heart,
      titleKey: 'features.tss.title',
      descriptionKey: 'features.tss.description',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
    },
    {
      icon: TrendingUp,
      titleKey: 'features.progress.title',
      descriptionKey: 'features.progress.description',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ]

  const stats = [
    { icon: Timer, value: '24/7', labelKey: 'stats.availability' },
    { icon: Mountain, value: '∞', labelKey: 'stats.possibilities' },
    { icon: Award, value: '100%', labelKey: 'stats.dedication' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Hero Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8">
          <Bike className="h-5 w-5" />
          <span className="text-sm font-medium">{t('hero.badge')}</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          {t('hero.title.part1')} <span className="text-primary">{t('hero.title.highlight')}</span>{' '}
          {t('hero.title.part2')}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
          {t('hero.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              {t('hero.cta.primary')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              {t('hero.cta.secondary')}
            </Button>
          </Link>
        </div>
      </section>

      {/* Mission Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <Card className="border-none bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 overflow-hidden">
          <CardContent className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('mission.title')}</h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t('mission.description')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Stats Section */}
      <section className="container max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 md:gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <stat.icon className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-3xl md:text-4xl font-bold">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{t(stat.labelKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('features.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="border-none bg-card/50 backdrop-blur hover:bg-card/80 transition-colors"
            >
              <CardContent className="p-6">
                <div
                  className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4`}
                >
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
                <p className="text-muted-foreground">{t(feature.descriptionKey)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('philosophy.title')}</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="leading-relaxed">{t('philosophy.paragraph1')}</p>
              <p className="leading-relaxed">{t('philosophy.paragraph2')}</p>
              <p className="leading-relaxed">{t('philosophy.paragraph3')}</p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <div className="text-center">
                <Bike className="h-24 w-24 mx-auto mb-4 text-primary" />
                <p className="text-2xl font-bold">{t('philosophy.quote')}</p>
                <p className="text-muted-foreground mt-2">{t('philosophy.quoteAuthor')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <Card className="border-none bg-muted/50">
          <CardContent className="p-8 md:p-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t('team.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('team.description')}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="container max-w-6xl mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            {t('cta.subtitle')}
          </p>
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              {t('cta.button')}
              <Bike className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container max-w-6xl mx-auto px-4 py-8 border-t">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
          <p className="flex items-center gap-2">
            {t('footer.madeWith')} <Heart className="h-4 w-4 text-red-500 fill-red-500" />{' '}
            {t('footer.forCyclists')}
          </p>
        </div>
      </footer>
    </div>
  )
}
